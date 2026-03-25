const NavigationService = require('../services/NavigationService');

class NavigationController {
  static async getRoute(req, res) {
    try {
      const { origin, destination } = req.query;

      if (!origin || !destination) {
        return res.status(400).json({ 
          success: false, 
          message: 'Both origin and destination coordinates are required. Format: lat,lng' 
        });
      }

      const routeData = await NavigationService.getDirections(origin, destination);

      res.status(200).json({
        success: true,
        data: routeData
      });
      
    } catch (error) {
      console.error('NavigationController getRoute error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch navigation route',
        error: error.message 
      });
    }
  }
}

module.exports = NavigationController;