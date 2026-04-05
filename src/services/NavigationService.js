const { GOOGLE_MAPS_API_KEY } = process.env;

class NavigationService {
  // Add mode parameter with a default fallback
  static async getDirections(origin, destination, mode = 'driving') {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not defined in environment variables');
    }

    // Append the mode dynamically to the Google Directions API URL
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      // Extract only what the frontend needs to save bandwidth
      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        polyline: route.overview_polyline.points,
        distance: leg.distance, // { text: "2.5 mi", value: 4023 }
        duration: leg.duration, // { text: "10 mins", value: 600 }
        startLocation: leg.start_location,
        endLocation: leg.end_location,
      };
    } catch (error) {
      console.error('Error fetching directions:', error.message);
      throw error;
    }
  }
}

module.exports = NavigationService;