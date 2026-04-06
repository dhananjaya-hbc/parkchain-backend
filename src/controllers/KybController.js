const KybSubmission = require('../models/KybSubmission');

class KybController {
  /**
   * POST /api/kyb
   * Submits a Know Your Business (KYB) application for a seller adding a spot.
   */
  static async submitKyb(req, res) {
    try {
      const user = req.user; // Assuming authMiddleware populated this
      
      const { entityName, address, googleMapsLink, spotType } = req.body;
      const file = req.file;

      if (!entityName || !address || !spotType) {
        return res.status(400).json({ error: 'Missing required text fields for KYB.' });
      }

      if (!file || !file.path) {
        return res.status(400).json({ error: 'Document file is required for KYB.' });
      }

      const documentUrl = file.path; // Secured Cloudinary URL returned by multer

      // Save to Database
      const submission = await KybSubmission.create({
        ownerId: user.id,
        entityName,
        address,
        googleMapsLink,
        spotType,
        documentUrl
      });

      return res.status(201).json({
        message: 'KYB submission successful.',
        submission
      });
    } catch (error) {
      console.error('Error submitting KYB:', error);
      return res.status(500).json({ error: 'Internal server error during KYB submission.' });
    }
  }
}

module.exports = KybController;
