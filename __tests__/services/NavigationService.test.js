/**
 * @fileoverview Unit tests for NavigationService.
 * Validates Google Maps API interactions, URL construction, data formatting (HTML stripping), 
 * route limiting, and comprehensive error handling.
 */

describe('NavigationService', () => {
    let NavigationService;

    /**
     * Helper to freshly require the NavigationService.
     * This is needed because the service evaluates `process.env.GOOGLE_MAPS_API_KEY` upon instantiation.
     * @returns {Class} The un-cached NavigationService class.
     */
    const loadService = () => require('../../src/services/NavigationService');

    beforeEach(() => {
        // Clear module cache to ensure fresh environment variable reads
        jest.resetModules();
        jest.clearAllMocks();
        
        // Set standard environment variables for tests
        process.env.GOOGLE_MAPS_API_KEY = 'test-google-key';
        
        // Mock the global fetch API
        global.fetch = jest.fn();
        NavigationService = loadService();
    });

    afterEach(() => {
        // Clean up environment variables
        delete process.env.GOOGLE_MAPS_API_KEY;
    });

    describe('getDirections()', () => {

        // ==========================================
        // CONFIGURATION & VALIDATION TESTS
        // ==========================================

        it('should throw if GOOGLE_MAPS_API_KEY is missing', async () => {
            // Arrange
            jest.resetModules();
            delete process.env.GOOGLE_MAPS_API_KEY;
            NavigationService = loadService(); // Load service *after* deleting the env var

            // Act & Assert
            await expect(
                NavigationService.getDirections('1,1', '2,2')
            ).rejects.toThrow('GOOGLE_MAPS_API_KEY is not defined in environment variables');
        });

        it('should throw if GOOGLE_MAPS_API_KEY is an empty string', async () => {
            // Arrange
            jest.resetModules();
            process.env.GOOGLE_MAPS_API_KEY = ''; // Falsy value
            NavigationService = loadService();

            // Act & Assert
            await expect(
                NavigationService.getDirections('1,1', '2,2')
            ).rejects.toThrow('GOOGLE_MAPS_API_KEY is not defined in environment variables');
        });

        // ==========================================
        // URL & API CALL TESTS
        // ==========================================

        it('should call Google Directions API with the correct default URL (driving)', async () => {
            // Arrange
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({ status: 'OK', routes: [] }),
            });

            // Act
            // Omitting the 'mode' parameter to test default fallback
            await NavigationService.getDirections('6.9271,79.8612', '6.9350,79.8500');

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                'https://maps.googleapis.com/maps/api/directions/json?origin=6.9271,79.8612&destination=6.9350,79.8500&mode=driving&alternatives=true&key=test-google-key'
            );
        });

        it('should call Google Directions API with custom mode if provided', async () => {
            // Arrange
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({ status: 'OK', routes: [] }),
            });

            // Act
            // Passing 'walking' as the explicit mode
            await NavigationService.getDirections('6.9271,79.8612', '6.9350,79.8500', 'walking');

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                'https://maps.googleapis.com/maps/api/directions/json?origin=6.9271,79.8612&destination=6.9350,79.8500&mode=walking&alternatives=true&key=test-google-key'
            );
        });

        // ==========================================
        // DATA PARSING & BUSINESS LOGIC TESTS
        // ==========================================

        it('should map and sanitize route data correctly (stripping HTML)', async () => {
            // Arrange
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    routes: [
                        {
                            overview_polyline: { points: 'encoded-polyline-1' },
                            legs: [
                                {
                                    distance: { text: '2.5 km', value: 2500 },
                                    duration: { text: '8 mins', value: 480 },
                                    start_location: { lat: 6.9271, lng: 79.8612 },
                                    end_location: { lat: 6.9350, lng: 79.8500 },
                                    steps: [
                                        {
                                            html_instructions: '<b>Turn left</b> onto <i>Main St</i>',
                                            distance: { value: 120 },
                                            maneuver: 'turn-left',
                                            end_location: { lat: 6.928, lng: 79.860 },
                                        },
                                        {
                                            html_instructions: null,
                                            distance: null, // Testing fallback to 0
                                            end_location: { lat: 6.929, lng: 79.859 },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            });

            // Act
            const result = await NavigationService.getDirections('6.9271,79.8612', '6.9350,79.8500');

            // Assert
            expect(result).toEqual({
                routes: [
                    expect.objectContaining({
                        routeIndex: 0,
                        isFastest: true,
                        polyline: 'encoded-polyline-1',
                        distance: { text: '2.5 km', value: 2500 },
                        duration: { text: '8 mins', value: 480 },
                        startLocation: { lat: 6.9271, lng: 79.8612 },
                        endLocation: { lat: 6.9350, lng: 79.8500 },
                        steps: [
                            {
                                instruction: 'Turn left onto Main St', // Verifies all HTML tags are stripped
                                distanceValue: 120,
                                maneuver: 'turn-left',
                                endLocation: { lat: 6.928, lng: 79.86 },
                            },
                            {
                                instruction: '', // Verifies null instruction fallback
                                distanceValue: 0, // Verifies null distance fallback
                                maneuver: 'straight', // Verifies missing maneuver fallback
                                endLocation: { lat: 6.929, lng: 79.859 },
                            },
                        ],
                    }),
                ],
            });
        });

        it('should limit returned routes to a maximum of 3 and mark only the first as fastest', async () => {
            // Arrange
            // Create a helper to generate mock routes easily
            const generateMockRoute = (index) => ({
                overview_polyline: { points: `poly-${index}` },
                legs: [
                    {
                        distance: { text: `${index} km`, value: index * 1000 },
                        duration: { text: '5 mins', value: 300 },
                        start_location: { lat: 1, lng: 1 },
                        end_location: { lat: 1.1, lng: 1.1 },
                        steps: [],
                    },
                ],
            });

            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    routes: [
                        generateMockRoute(1),
                        generateMockRoute(2),
                        generateMockRoute(3),
                        generateMockRoute(4), // This 4th route should be sliced off
                    ],
                }),
            });

            // Act
            const result = await NavigationService.getDirections('1,1', '2,2');

            // Assert
            expect(result.routes).toHaveLength(3); // Enforce the limit
            expect(result.routes[0].isFastest).toBe(true);
            expect(result.routes[1].isFastest).toBe(false);
            expect(result.routes[2].isFastest).toBe(false);
        });

        it('should safely return an empty routes array if Google Maps returns no routes', async () => {
            // Arrange
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: 'OK',
                    routes: [], // Empty array returned from API
                }),
            });

            // Act
            const result = await NavigationService.getDirections('1,1', '2,2');

            // Assert
            expect(result.routes).toBeDefined();
            expect(result.routes).toHaveLength(0); // Should not crash trying to access legs[0]
        });

        // ==========================================
        // ERROR HANDLING TESTS
        // ==========================================

        it('should throw when Google Maps returns a non-OK status with an error message', async () => {
            // Arrange
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: 'ZERO_RESULTS',
                    error_message: 'No routes found for the given locations',
                    routes: [],
                }),
            });

            // Act & Assert
            await expect(
                NavigationService.getDirections('1,1', '2,2')
            ).rejects.toThrow('Google Maps API error: ZERO_RESULTS - No routes found for the given locations');

            // Cleanup
            errorSpy.mockRestore();
        });

        it('should throw with a fallback unknown error if Google Maps returns non-OK status without an error message', async () => {
            // Arrange
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: 'REQUEST_DENIED', // Status is not OK, but no error_message provided
                }),
            });

            // Act & Assert
            await expect(
                NavigationService.getDirections('1,1', '2,2')
            ).rejects.toThrow('Google Maps API error: REQUEST_DENIED - Unknown error'); // Expects fallback text

            // Cleanup
            errorSpy.mockRestore();
        });

        it('should rethrow generic fetch errors and log them', async () => {
            // Arrange
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            global.fetch.mockRejectedValue(new Error('Network down'));

            // Act & Assert
            await expect(
                NavigationService.getDirections('1,1', '2,2')
            ).rejects.toThrow('Network down');

            // Verify the catch block logs the error properly before re-throwing
            expect(errorSpy).toHaveBeenCalledWith('Error fetching directions:', 'Network down');

            // Cleanup
            errorSpy.mockRestore();
        });
    });
});