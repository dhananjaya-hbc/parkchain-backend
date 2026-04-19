describe('NavigationService (Your Responsibilities)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // clears the cache
    process.env = { ...ORIGINAL_ENV }; // Make a copy
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV; // Restore old env
  });

  describe('getDirections', () => {
    test('should fetch valid directions and parse them correctly', async () => {
      // Must set the env before requiring the module
      process.env.GOOGLE_MAPS_API_KEY = 'fake_api_key';
      const NavigationService = require('../../src/services/NavigationService');

      // Mock the global fetch API to simulate Google Maps response
      const mockGoogleMapsResponse = {
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: 'abcxyz' },
            legs: [{
              distance: { text: "5.0 km", value: 5000 },
              duration: { text: "15 mins", value: 900 },
              start_location: { lat: 0, lng: 0 },
              end_location: { lat: 1, lng: 1 },
              steps: [
                {
                  html_instructions: 'Head <b>north</b>',
                  distance: { value: 100 },
                  maneuver: 'turn-right',
                  end_location: { lat: 0.1, lng: 0.1 }
                }
              ]
            }]
          }
        ]
      };

      global.fetch = jest.fn(() => 
        Promise.resolve({ 
            json: () => Promise.resolve(mockGoogleMapsResponse) 
        })
      );

      const origin = '40.71,-74.00';
      const destination = '40.73,-73.98';

      const result = await NavigationService.getDirections(origin, destination);

      // Assertions
      expect(global.fetch).toHaveBeenCalledWith(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&alternatives=true&key=fake_api_key`
      );

      expect(result.routes).toBeDefined();
      expect(result.routes.length).toBe(1);
      expect(result.routes[0].isFastest).toBe(true);
      expect(result.routes[0].distance.text).toBe('5.0 km');
      expect(result.routes[0].polyline).toBe('abcxyz');
      
      // Test HTML stripping logic
      expect(result.routes[0].steps[0].instruction).toBe('Head north');
    });

    test('should throw error if GOOGLE_MAPS_API_KEY is not defined', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      const NavigationService = require('../../src/services/NavigationService');

      await expect(NavigationService.getDirections('1,1', '2,2'))
        .rejects
        .toThrow('GOOGLE_MAPS_API_KEY is not defined in environment variables');
    });

    test('should throw error if Google Maps API returns non-OK status', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'fake_api_key';
      const NavigationService = require('../../src/services/NavigationService');

      const mockErrorResponse = {
        status: 'REQUEST_DENIED',
        error_message: 'The provided API key is invalid.'
      };

      global.fetch = jest.fn(() => 
        Promise.resolve({ json: () => Promise.resolve(mockErrorResponse) })
      );

      await expect(NavigationService.getDirections('1,1', '2,2'))
        .rejects
        .toThrow('Google Maps API error: REQUEST_DENIED - The provided API key is invalid.');
    });
  });
});
