/**
 * @fileoverview Unit tests for the NavigationController.
 * Ensures proper handling of route requests, input validation, data formatting, and error management.
 */

// Mock the NavigationService to isolate controller logic and prevent actual API calls
jest.mock('../../src/services/NavigationService');

const NavigationService = require('../../src/services/NavigationService');
const NavigationController = require('../../src/controllers/NavigationController');

/**
 * Generates a mock Express Request object.
 * @param {Object} overrides - Optional properties to override the default request structure.
 * @returns {Object} A mocked Express Request object.
 */
const mockReq = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    user: { id: 'driver-uuid', role: 'driver' },
    ...overrides,
});

/**
 * Generates a mock Express Response object with chainable Jest spies.
 * @returns {Object} A mocked Express Response object containing `status` and `json` methods.
 */
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('NavigationController', () => {
    // Ensure a clean state for mocks before every test to prevent test leakage
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getRoute()', () => {
        
        // ==========================================
        // VALIDATION TESTS
        // ==========================================
        
        it('should return 400 if origin is missing', async () => {
            // Arrange
            const req = mockReq({ query: { destination: '6.9271,79.8612', mode: 'Bike' } });
            const res = mockRes();

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Both origin and destination coordinates are required. Format: lat,lng',
                })
            );
            expect(NavigationService.getDirections).not.toHaveBeenCalled();
        });

        it('should return 400 if destination is missing', async () => {
            // Arrange
            const req = mockReq({ query: { origin: '6.9271,79.8612', mode: 'SUV' } });
            const res = mockRes();

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(NavigationService.getDirections).not.toHaveBeenCalled();
        });

        it('should return 400 if both origin and destination are missing', async () => {
            // Arrange: Query is completely empty
            const req = mockReq({ query: {} });
            const res = mockRes();

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(NavigationService.getDirections).not.toHaveBeenCalled();
        });

        it('should return 400 if origin and destination are empty strings', async () => {
            // Arrange: Falsy string values
            const req = mockReq({ query: { origin: '', destination: '' } });
            const res = mockRes();

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(NavigationService.getDirections).not.toHaveBeenCalled();
        });

        // ==========================================
        // BUSINESS LOGIC & SUCCESS TESTS
        // ==========================================

        it('should override provided mode and call NavigationService with "driving" mode', async () => {
            // Arrange
            const req = mockReq({
                query: { origin: '6.9271,79.8612', destination: '6.9350,79.8500', mode: 'Bike' },
            });
            const res = mockRes();
            NavigationService.getDirections.mockResolvedValue({});

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(NavigationService.getDirections).toHaveBeenCalledWith(
                '6.9271,79.8612',
                '6.9350,79.8500',
                'driving', // Must enforce driving regardless of 'Bike'
                true // avoidHighways should be true for 'Bike'
            );
        });

        it('should default to "driving" mode even if no mode is provided in query', async () => {
            // Arrange: Mode is completely omitted
            const req = mockReq({
                query: { origin: '6.9271,79.8612', destination: '6.9350,79.8500' },
            });
            const res = mockRes();
            NavigationService.getDirections.mockResolvedValue({});

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(NavigationService.getDirections).toHaveBeenCalledWith(
                '6.9271,79.8612',
                '6.9350,79.8500',
                'driving',
                false
            );
        });

        it('should return 200 and pass exact route data from service to the response', async () => {
            // Arrange
            const req = mockReq({
                query: { origin: '6.9271,79.8612', destination: '6.9350,79.8500' },
            });
            const res = mockRes();
            
            const mockRouteData = { distance: '10km', duration: '15 mins', polyline: 'abcde12345' };
            NavigationService.getDirections.mockResolvedValue(mockRouteData);

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockRouteData // Verifies exact payload mapping
            });
        });

        // ==========================================
        // ERROR HANDLING TESTS
        // ==========================================

        it('should return 500 with error message when NavigationService throws', async () => {
            // Arrange
            const req = mockReq({
                query: { origin: '6.9271,79.8612', destination: '6.9350,79.8500' },
            });
            const res = mockRes();
            const errorMessage = 'Google Maps API limits exceeded';

            jest.spyOn(console, 'error').mockImplementation(() => {});
            NavigationService.getDirections.mockRejectedValue(new Error(errorMessage));

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to fetch navigation route',
                error: errorMessage, // Expects error.message extraction
            });

            // Cleanup
            console.error.mockRestore();
        });

        it('should log the actual error to console.error when an exception occurs', async () => {
            // Arrange
            const req = mockReq({
                query: { origin: '6.9271,79.8612', destination: '6.9350,79.8500' },
            });
            const res = mockRes();
            const mockError = new Error('Network timeout');

            // Spy on console.error to verify logging behavior
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            NavigationService.getDirections.mockRejectedValue(mockError);

            // Act
            await NavigationController.getRoute(req, res);

            // Assert
            expect(consoleSpy).toHaveBeenCalledWith('NavigationController getRoute error:', mockError);

            // Cleanup
            consoleSpy.mockRestore();
        });
    });
});