const httpMocks = require('node-mocks-http');
const NavigationController = require('../../src/controllers/NavigationController');
const NavigationService = require('../../src/services/NavigationService');

jest.mock('../../src/services/NavigationService');

describe('NavigationController (Your Responsibilities)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoute', () => {
    test('should fetch and return a route successfully', async () => {
      const req = httpMocks.createRequest({
        method: 'GET',
        url: '/api/navigation/route',
        query: { 
            origin: '40.7128,-74.0060', 
            destination: '40.7306,-73.9866' 
        }
      });
      const res = httpMocks.createResponse();

      const mockRouteData = {
          distance: '5.0 km',
          duration: '15 mins',
          polyline: 'abcxyz'
      };

      NavigationService.getDirections.mockResolvedValue(mockRouteData);

      await NavigationController.getRoute(req, res);

      expect(res.statusCode).toBe(200);
      expect(NavigationService.getDirections).toHaveBeenCalledWith(
        '40.7128,-74.0060',
        '40.7306,-73.9866',
        'driving' // Important: ensures we map 'bike'/'SUV' to 'driving'
      );
      
      const responseData = res._getJSONData();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject(mockRouteData);
    });

    test('should return 400 if origin or destination is missing', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            query: { origin: '40.7128,-74.0060' } // Missing destination
        });
        const res = httpMocks.createResponse();

        await NavigationController.getRoute(req, res);

        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().success).toBe(false);
    });

    test('should return 500 error if NavigationService throws an exception', async () => {
      const req = httpMocks.createRequest({ 
        method: 'GET',
        query: { origin: '1,1', destination: '2,2' }
      });
      const res = httpMocks.createResponse();

      NavigationService.getDirections.mockRejectedValue(new Error('Google API Quota Exceeded'));

      await NavigationController.getRoute(req, res);

      expect(res.statusCode).toBe(500);
      expect(res._getJSONData().message).toBe('Failed to fetch navigation route');
      expect(res._getJSONData().error).toBe('Google API Quota Exceeded');
    });
  });
});
