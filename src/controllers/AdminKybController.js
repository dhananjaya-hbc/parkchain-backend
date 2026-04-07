const KybSubmission = require('../models/KybSubmission');
const User = require('../models/User');
const { query } = require('../config/db');

class AdminKybController {
  /**
   * GET /api/admin/kyb
   * Returns a list of all KYB submissions formatted as a raw array.
   */
  static async getAllSubmissions(req, res) {
    try {
      const submissions = await KybSubmission.findAll();
      
      const formattedSubmissions = submissions.map(sub => ({
        id: sub.id,
        entityName: sub.entityName || sub.entity_name,
        spotType: sub.spotType || sub.spot_type,
        address: sub.address,
        date: sub.date,
        status: sub.status === 'approved' ? 'verified' : sub.status
      }));

      // Return EXACT array format requested by frontend
      return res.status(200).json(formattedSubmissions);
    } catch (error) {
      console.error('Error fetching pending KYB submissions:', error);
      return res.status(500).json({ error: 'Internal server error while fetching submissions.' });
    }
  }

  /**
   * GET /api/admin/kyb/:id
   * Fetches full details of a specific KYB submission by ID along with its Owner's name/email.
   */
  static async getSubmissionDetails(req, res) {
    try {
      const { id } = req.params;
      const submission = await KybSubmission.findById(id);

      if (!submission) {
        return res.status(404).json({ error: 'KYB submission not found.' });
      }

      // Map to camelCase exactly as requested
      const formattedSubmission = {
        id: submission.id,
        ownerName: submission.owner_name,
        entityName: submission.entity_name,
        address: submission.address,
        googleMapsLink: submission.google_maps_link,
        spotType: submission.spot_type,
        documentUrl: submission.document_url,
        date: submission.date,
        status: submission.status === 'approved' ? 'verified' : submission.status,
        adminNotes: submission.admin_notes || ""
      };

      // Return raw object exactly as requested
      return res.status(200).json(formattedSubmission);
    } catch (error) {
      console.error('Error fetching KYB submission details:', error);
      return res.status(500).json({ error: 'Internal server error while fetching details.' });
    }
  }

  /**
   * PUT /api/admin/kyb/:id/status
   * Updates the status of a KYB submission.
   */
  static async updateSubmissionStatus(req, res) {
    try {
      const { id } = req.params;
      let { status, adminNotes } = req.body;

      // Map 'verified' to 'approved' internally
      const INTERNAL_STATUS = status === 'verified' ? 'approved' : status;

      if (!['approved', 'rejected', 'pending'].includes(INTERNAL_STATUS)) {
        return res.status(400).json({ error: 'Invalid status update. Only `verified` or `rejected` allowed.' });
      }

      const submission = await KybSubmission.findById(id);
      if (!submission) {
        return res.status(404).json({ error: 'KYB submission not found.' });
      }

      // Update the DB
      const updatedSubmission = await KybSubmission.updateStatus(id, INTERNAL_STATUS, adminNotes);

      // Post-approval hooks
      if (INTERNAL_STATUS === 'approved') {
        // Upgrade user to seller
        await query(
           `UPDATE users SET role = 'seller' WHERE id = $1 AND role = 'driver'`,
           [submission.owner_id]
        );
        
        // Also mark any of their unapproved spots as approved/active
        await query(
          `UPDATE spots SET is_approved = true, is_available = true WHERE owner_id = $1`,
          [submission.owner_id]
        );
      }

      return res.status(200).json({
        id: updatedSubmission.id,
        status: updatedSubmission.status === 'approved' ? 'verified' : updatedSubmission.status,
        adminNotes: updatedSubmission.admin_notes
      });
    } catch (error) {
      console.error('Error updating KYB submission status:', error);
      return res.status(500).json({ error: 'Internal server error while updating status.' });
    }
  }
}

module.exports = AdminKybController;
