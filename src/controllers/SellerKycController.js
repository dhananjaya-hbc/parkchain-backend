const { query } = require('../config/db');

/**
 * 1. Submit or Update KYC Application
 * POST /api/seller/kyc
 */
exports.submitKyc = async (req, res) => {
  try {
    const {
      fullName, nicNumber, dateOfBirth, gender, propertyName,
      fullAddress, mapsLink, parkingType, numberOfSlots,
      supportedVehicleTypes, ownershipDocumentType, agreementAccepted,
      nicFrontUrl, nicBackUrl, selfieUrl, legalDocumentUrl,
      utilityBillUrl, sellerEmail, sellerWallet
    } = req.body;

    // First find the user by email
    const userResult = await query('SELECT id FROM users WHERE email = $1', [sellerEmail]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found. Please make sure the email is correct.' });
    }
    
    const userId = userResult.rows[0].id;

    // Verify user role is "seller" -- if not, we can upgrade them to seller automatically or reject
    await query('UPDATE users SET role = $1 WHERE id = $2 AND role != $1', ['seller', userId]);

    // Insert or update KYC data
    await query(
      `INSERT INTO seller_kyc (
        user_id, full_name, nic_number, date_of_birth, gender,
        property_name, full_address, maps_link, parking_type, number_of_slots,
        supported_vehicle_types, ownership_document_type, agreement_accepted,
        nic_front_url, nic_back_url, selfie_url, legal_document_url, utility_bill_url, seller_wallet
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        nic_number = EXCLUDED.nic_number,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        property_name = EXCLUDED.property_name,
        full_address = EXCLUDED.full_address,
        maps_link = EXCLUDED.maps_link,
        parking_type = EXCLUDED.parking_type,
        number_of_slots = EXCLUDED.number_of_slots,
        supported_vehicle_types = EXCLUDED.supported_vehicle_types,
        ownership_document_type = EXCLUDED.ownership_document_type,
        nic_front_url = EXCLUDED.nic_front_url,
        nic_back_url = EXCLUDED.nic_back_url,
        selfie_url = EXCLUDED.selfie_url,
        legal_document_url = EXCLUDED.legal_document_url,
        utility_bill_url = EXCLUDED.utility_bill_url,
        seller_wallet = EXCLUDED.seller_wallet,
        updated_at = NOW()`,
      [
        userId, fullName, nicNumber, dateOfBirth, gender, propertyName, fullAddress,
        mapsLink, parkingType, parseInt(numberOfSlots || 0), JSON.stringify(supportedVehicleTypes || []),
        ownershipDocumentType, agreementAccepted, nicFrontUrl, nicBackUrl,
        selfieUrl, legalDocumentUrl, utilityBillUrl, sellerWallet
      ]
    );

    // Update KYC status to "pending_review" in the users table
    await query(
      `UPDATE users SET kyc_status = 'pending_review' WHERE id = $1`,
      [userId]
    );

    res.status(200).json({ 
      success: true, 
      message: 'KYC documents submitted successfully.', 
      status: 'pending_review' 
    });

  } catch (error) {
    console.error('Error submitting KYC:', error);
    res.status(500).json({ error: 'Failed to submit KYC data.' });
  }
};

/**
 * 2. Get All Pending KYC Applications (For Admin Dashboard)
 * GET /api/seller/kyc
 */
exports.getAllKycApplications = async (req, res) => {
  try {
    const { status } = req.query; // e.g. ?status=pending_review
    
    let dbQuery = `
      SELECT 
        k.*, 
        u.email, 
        u.kyc_status, 
        u.is_verified,
        u.ROLE
      FROM seller_kyc k
      JOIN users u ON k.user_id = u.id
    `;
    
    const queryParams = [];
    
    // Filter by status if provided
    if (status) {
      dbQuery += ` WHERE u.kyc_status = $1`;
      queryParams.push(status);
    }
    
    dbQuery += ` ORDER BY k.created_at DESC`;

    const result = await query(dbQuery, queryParams);
    
    res.status(200).json({ 
      success: true, 
      count: result.rows.length,
      data: result.rows 
    });
  } catch (error) {
    console.error('Error fetching KYC applications:', error);
    res.status(500).json({ error: 'Failed to fetch KYC applications.' });
  }
};

/**
 * 3. Get Specific KYC Data by User ID (For Seller Dashboard/Admin Inspection)
 * GET /api/seller/kyc/:userId
 */
exports.getKycByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT 
        k.*, 
        u.email as account_email, 
        u.kyc_status, 
        u.is_verified
       FROM seller_kyc k
       JOIN users u ON k.user_id = u.id
       WHERE k.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Check if user exists but just hasn't submitted KYC
      const userCheck = await query('SELECT kyc_status FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length > 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'No KYC record found for this user',
          kyc_status: userCheck.rows[0].kyc_status 
        });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Error fetching KYC data:', error);
    res.status(500).json({ error: 'Failed to fetch KYC data.' });
  }
};

/**
 * 4. Update KYC Status (Approve or Reject - For Admin Dashboard)
 * PATCH /api/seller/kyc/:userId/status
 */
exports.updateKycStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // e.g. "verified" or "rejected"

    if (!['unverified', 'pending_review', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid KYC status' });
    }

    // Begin transaction for safety (ensure both kyc_status and is_verified update simultaneously if approved)
    await query('BEGIN');

    // Update kyc_status
    await query(`UPDATE users SET kyc_status = $1 WHERE id = $2`, [status, userId]);

    // If verified, mark user account as completely 'is_verified'
    if (status === 'verified') {
      await query(`UPDATE users SET is_verified = true WHERE id = $1`, [userId]);
    } else if (status === 'rejected' || status === 'unverified') {
      await query(`UPDATE users SET is_verified = false WHERE id = $1`, [userId]);
    }

    await query('COMMIT');

    res.status(200).json({ 
      success: true, 
      message: `KYC status successfully updated to ${status}` 
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error updating KYC status:', error);
    res.status(500).json({ error: 'Failed to update KYC status.' });
  }
};

/**
 * 5. Get KYC Status by Email
 * GET /api/seller/kyc/status?email=test@test.com
 */
exports.getKycStatusByEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await query(
      `SELECT kyc_status FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      // User not found at all, return unverified
      return res.status(200).json({ status: 'unverified' });
    }

    res.status(200).json({ status: result.rows[0].kyc_status || 'unverified' });
  } catch (error) {
    console.error('Error fetching KYC status by email:', error);
    res.status(500).json({ error: 'Failed to fetch KYC status' });
  }
};
