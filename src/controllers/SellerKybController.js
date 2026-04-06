const KybSubmission = require('../models/KybSubmission');

class SellerKybController {
  /**
   * GET /api/seller/kyb/my-requests
   * Fetches all KYB requests for the currently authenticated user
   */
  static async getMyRequests(req, res) {
    try {
      const ownerId = req.user.id;

      // Query the database for records belonging ONLY to this user, newest first
      const submissions = await KybSubmission.findByOwnerId(ownerId);

      // Securely map to the exact JSON structure expected by the frontend
      const formattedSubmissions = submissions.map(sub => ({
        id: sub.id,
        entityName: sub.entity_name,
        status: sub.status === 'approved' ? 'verified' : sub.status,
        adminNotes: sub.admin_notes || ""
      }));

      // Return raw array directly
      return res.status(200).json(formattedSubmissions);

    } catch (error) {
      console.error('Error fetching seller requests:', error);
      return res.status(500).json({ error: 'Internal server error while fetching seller requests.' });
    }
  }
}

module.exports = SellerKybController;
