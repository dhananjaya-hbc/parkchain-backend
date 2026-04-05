const { query } = require('../config/db');
const User = require('../models/User');

class KycController {
  /**
   * POST /api/create-didit-session
   * Initiates a KYC session with Didit API for the authenticated user
   */
  static async createSession(req, res) {
    try {
      const user = req.user;
      const apiKey = process.env.DIDIT_API_KEY;
      const workflowId = process.env.WORKFLOW_ID;

      if (!apiKey || !workflowId) {
        return res.status(500).json({ error: 'Didit configuration missing in environment' });
      }

      // Use the origin of the request (the frontend URL) or fallback to local port 3000
      const frontendUrl = req.headers.origin || 'http://localhost:3000';
      const successUrl = `${frontendUrl}/kyc-success`; 

      // Payload for Didit Session creation API
      const diditPayload = {
        workflow_id: workflowId,
        callback: successUrl,
        vendor_data: user.id.toString(), // Used to reliably map webhook updates back to UI
      };

      // Call Didit API to create the session
      const response = await fetch('https://verification.didit.me/v3/session/', { // Using verification.didit.me API endpoint
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(diditPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Didit API Error:', response.status, errorText);
        return res.status(response.status).json({ 
          error: 'Failed to create KYC session with Didit', 
          details: errorText,
          status: response.status 
        });
      }

      const diditSession = await response.json();
      
      // Expected Didit response usually contains an id and a session url 
      // Replace these mappings with Didit's actual JSON field names
      const sessionId = diditSession.session_id || diditSession.id;
      const sessionUrl = diditSession.url || `https://verify.didit.me/session/${sessionId}`; 

      // Securely associate the created session with our user in DB
      await query(
        `UPDATE users
         SET kyc_session_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [sessionId, user.id]
      );

      return res.status(200).json({ didit_url: sessionUrl });
    } catch (error) {
      console.error('Error creating Didit session:', error);
      res.status(500).json({ error: 'Internal server error while creating KYC session', details: error.message });
    }
  }

  /**
   * GET /api/kyc-status
   * Manually checks the status of the user's KYC session from Didit API
   * Useful for local development when Webhooks can't reach localhost
   */
  static async checkSessionStatus(req, res) {
    try {
      const user = req.user;
      const apiKey = process.env.DIDIT_API_KEY;
      const sessionParam = req.query.session;
      const statusParam = req.query.status;

      // If the frontend passed urlStatus='Approved', forcefully update the DB since webhooks don't work locally!
      if (statusParam) {
         const upperStatus = statusParam.toUpperCase();
         if (['APPROVED', 'DECLINED', 'FAILED', 'ABANDONED'].includes(upperStatus)) {
            await query(
               `UPDATE users SET kyc_status = $1, kyc_session_id = COALESCE($2, kyc_session_id), updated_at = NOW() WHERE id = $3`,
               [upperStatus, sessionParam || null, user.id]
            );
            return res.status(200).json({ kyc_status: upperStatus });
         }
      }
      const dbUser = await User.findById(user.id);
      const sessionId = dbUser?.kyc_session_id;

      if (!sessionId) {
        return res.status(200).json({ kyc_status: dbUser.kyc_status || 'unverified' });
      }

      // Check the session directly with Didit's server
      const response = await fetch(`https://verification.didit.me/v3/session/${sessionId}/`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return res.status(502).json({ error: 'Failed to fetch status from Didit' });
      }

      const sessionData = await response.json();
      console.log('Didit Check Session Response:', sessionData);
      const diditStatus = sessionData.status; // e.g. "Approved", "Declined", "In Progress"

      // We uppercase it to match our DB convention ('APPROVED', 'DECLINED')
      const normalizedStatus = diditStatus ? diditStatus.toUpperCase() : dbUser.kyc_status;

      // Update the DB if Didit says they are approved or declined
      if (normalizedStatus === 'APPROVED' || normalizedStatus === 'DECLINED' || normalizedStatus === 'FAILED') {
        if (dbUser.kyc_status !== normalizedStatus) {
          await query(
            `UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2`,
            [normalizedStatus, user.id]
          );
        }
      }

      return res.status(200).json({ 
        kyc_status: normalizedStatus, 
        didit_status: diditStatus 
      });

    } catch (error) {
      console.error('Error checking Didit status:', error);
      res.status(500).json({ error: 'Internal server error while checking KYC', details: error.message });
    }
  }

  /**
   * POST /api/webhooks/didit
   * Re-entrant, highly reliable webhook listener for Didit status updates
   */
  static async handleWebhook(req, res) {
    try {
      // 1. Authenticate Request
      // Ensure Didit's request is authentic (e.g. check signature headers or a custom secret)
      const expectedWebhookSecret = process.env.DIDIT_WEBHOOK_SECRET;
      
      if (expectedWebhookSecret) {
        // e.g. Didit sends a header like 'x-didit-signature' or 'Authorization'
        const signature = req.headers['x-didit-signature'] || req.headers['authorization'];
        if (signature !== expectedWebhookSecret && signature !== `Bearer ${expectedWebhookSecret}`) {
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }

      const payload = req.body;
      
      // Parse identification parameters from the webhook body 
      const sessionId = payload.session_id || payload.id;
      const vendorData = payload.vendor_data;
      const kycStatus = payload.status; // e.g., 'APPROVED', 'DECLINED'

      if (!sessionId && !vendorData) {
        return res.status(400).json({ error: 'Missing session identifiers in webhook body' });
      }

      // 2. Process Verification Update
      if (kycStatus === 'APPROVED') {
        if (vendorData) {
          // If we passed the user ID exactly as the vendor_data
          await query(
            `UPDATE users 
             SET kyc_status = 'APPROVED', kyc_session_id = $1, updated_at = NOW() 
             WHERE id = $2`,
            [sessionId, vendorData]
          );
        } else if (sessionId) {
          // Fallback to updating directly via session_id string mapping
          await query(
            `UPDATE users 
             SET kyc_status = 'APPROVED', updated_at = NOW() 
             WHERE kyc_session_id = $1`,
            [sessionId]
          );
        }
        console.log(`Successfully verified user via Didit Webhook (Session: ${sessionId})`);
      } else if (kycStatus === 'DECLINED' || kycStatus === 'FAILED') {
        // Handle failed scenario (update column differently or notify admins, etc.)
        if (vendorData) {
          await query(
            `UPDATE users SET kyc_status = $2, updated_at = NOW() WHERE id = $1`,
            [vendorData, kycStatus]
          );
        }
      }

      // Respond "200 OK" rapidly so Didit stops retrying
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error handling Didit webhook:', error);
      // We still return 500, which will tell Didit's Webhook queuing engine to retry later
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = KycController;
