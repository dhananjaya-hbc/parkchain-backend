const KybSubmission = require('../models/KybSubmission');
const Spot = require('../models/Spot');

class SellerKybController {
  /**
   * GET /api/seller/kyb/my-requests
   * Fetches all KYB requests for the currently authenticated user
   */
  static async getMyRequests(req, res) {
    try {
      const ownerId = req.user.id;

      // All KYB requests for seller approvals/history pages
      const submissions = await KybSubmission.findByOwnerId(ownerId);

      const formattedSubmissions = submissions.map((sub) => ({
          id: sub.id,
          entityName: sub.entity_name,
          status: sub.status === 'approved' ? 'verified' : sub.status,
          adminNotes: sub.admin_notes || "",
      }));

      // Return raw array directly
      return res.status(200).json(formattedSubmissions);

    } catch (error) {
      console.error('Error fetching seller requests:', error);
      return res.status(500).json({ error: 'Internal server error while fetching seller requests.' });
    }
  }

  /**
   * GET /api/seller/kyb/approved
   * Returns approved KYBs for spot creation with spotCreated state.
   */
  static async getApprovedRequests(req, res) {
    try {
      const ownerId = req.user.id;
      const submissions = await KybSubmission.findByOwnerId(ownerId);
      const approvedSubmissions = submissions.filter((sub) => sub.status === 'approved');

      const formattedSubmissions = await Promise.all(approvedSubmissions.map(async (sub) => {
        const spot = await Spot.findByKybSubmissionId(sub.id);

        return {
          id: sub.id,
          name: sub.entity_name,
          address: sub.address,
          status: 'verified',
          spotCreated: Boolean(spot),
          adminNotes: sub.admin_notes || "",
          entityName: sub.entity_name
        };
      }));

      return res.status(200).json(formattedSubmissions);

    } catch (error) {
      console.error('Error fetching approved KYB requests:', error);
      return res.status(500).json({ error: 'Internal server error while fetching approved KYB requests.' });
    }
  }

  /**
   * GET /api/seller/kyb/:kybId
   * Returns one approved KYB for autofill.
   */
  static async getKybById(req, res) {
    try {
      const ownerId = req.user.id;
      const { kybId } = req.params;

      const kyb = await KybSubmission.findById(kybId);

      if (!kyb || kyb.owner_id !== ownerId) {
        return res.status(404).json({ error: 'KYB submission not found.' });
      }

      if (kyb.status !== 'approved') {
        return res.status(403).json({ error: 'KYB not approved.' });
      }

      return res.status(200).json({
        kybId: kyb.id,
        name: kyb.entity_name,
        googleMapsLink: kyb.google_maps_link,
        address: kyb.address,
        entityName: kyb.entity_name
      });

    } catch (error) {
      console.error('Error fetching KYB by ID:', error);
      return res.status(500).json({ error: 'Internal server error while fetching KYB.' });
    }
  }
}

module.exports = SellerKybController;
