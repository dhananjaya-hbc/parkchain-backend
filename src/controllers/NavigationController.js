const NavigationService = require('../services/NavigationService');

class NavigationController {
  static async getRoute(req, res) {
    try {
      // Extract mode from query (even if frontend sends "Bike" or "SUV")
      const { origin, destination, mode } = req.query;

      if (!origin || !destination) {
        return res.status(400).json({ 
          success: false, 
          message: 'Both origin and destination coordinates are required. Format: lat,lng' 
        });
      }

      // Since the app only supports "Bike" (Motorcycle) and "SUV/Car",
      // both MUST use the Google Maps "driving" mode because they both use standard roads.
      // Google's "bicycling" mode is for pedal bicycles and uses bike paths!
      const googleMode = 'driving'; 

      // Pass the forced 'driving' mode parameter to the service
      const routeData = await NavigationService.getDirections(origin, destination, googleMode);

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