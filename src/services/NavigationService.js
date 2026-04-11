// src/services/NavigationService.js
const { GOOGLE_MAPS_API_KEY } = process.env;

class NavigationService {
  // Add mode parameter with a default fallback
  static async getDirections(origin, destination, mode = 'driving') {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not defined in environment variables');
    }

    // Append the mode dynamically to the Google Directions API URL
    // ADDED: &alternatives=true to request multiple routes
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${mode}&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      // We need to map over the routes to extract the data for each one.
      // We limit to max 3 routes so we don't overwhelm the mobile client.
      const parsedRoutes = data.routes.slice(0, 3).map((route, index) => {
        const leg = route.legs[0];

        // Map the steps array to the required format for the mobile app
        const steps = leg.steps.map(step => {
          return {
            // Strip HTML tags from the instructions (e.g. "<b>Turn left</b>" -> "Turn left")
            instruction: step.html_instructions ? step.html_instructions.replace(/<[^>]*>?/gm, '') : '',
            distanceValue: step.distance ? step.distance.value : 0, // value in meters
            maneuver: step.maneuver || 'straight', // fallback maneuver
            endLocation: step.end_location
          };
        });

        return {
          routeIndex: index,
          isFastest: index === 0, // Google Maps API always returns the fastest route as the first index array element
          polyline: route.overview_polyline.points,
          distance: leg.distance, // { text: "2.5 mi", value: 4023 }
          duration: leg.duration, // { text: "10 mins", value: 600 }
          startLocation: leg.start_location,
          endLocation: leg.end_location,
          steps: steps
        };
      });

      // The structure the controller (and thus the frontend) expects for this object
      return {
        routes: parsedRoutes
      };
    } catch (error) {
      console.error('Error fetching directions:', error.message);
      throw error;
    }
  }
}

module.exports = NavigationService;