/**
 * @fileoverview Unit tests for the UtilsController.
 * Validates map link URL conversion, coordinate extraction through multiple regex patterns,
 * redirect handling via fetch, and comprehensive error fallback scenarios.
 */

const UtilsController = require('../../src/controllers/UtilsController');

/**
 * Generates a mock Express Request object.
 * @param {Object} overrides - Optional properties to override the default request structure.
 * @returns {Object} A mocked Express Request object.
 */
const mockReq = (overrides = {}) => ({
    body: {},
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

describe('UtilsController', () => {
    beforeEach(() => {
        // Clear module cache and mocks before each run
        jest.clearAllMocks();
        
        // Mock the global fetch API used for expanding map shortlinks
        global.fetch = jest.fn();
    });

    describe('convertMapLinkToCoords()', () => {
        
        // ==========================================
        // VALIDATION TESTS
        // ==========================================

        it('should return 400 if the map link is missing from the request body', async () => {
            // Arrange
            const req = mockReq({ body: {} }); // Missing link
            const res = mockRes();

            // Act
            await UtilsController.convertMapLinkToCoords(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Map link is required' });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        // ==========================================
        // REGEX EXTRACTION TESTS
        // ==========================================

        it('should extract coordinates using Pattern 1 (/@lat,lng)', async () => {
            // Arrange
            const link = 'https://maps.app.goo.gl/short123';
            const resolvedUrl = 'https://www.google.com/maps/place/Some+Location/@6.9271,79.8612,15z';
            const req = mockReq({ body: { link } });
            const res = mockRes();

            global.fetch.mockResolvedValue({ url: resolvedUrl });

            // Act
            await UtilsController.convertMapLinkToCoords(req, res);

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(link, { method: 'HEAD', redirect: 'follow' });
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                latitude: 6.9271,
                longitude: 79.8612,
                originalLink: link,
                resolvedUrl: resolvedUrl,
            });
        });

        it('should extract coordinates using Pattern 2 (?q=lat,lng) including negative values', async () => {
            // Arrange
            const link = 'https://maps.google.com/?q=-10.1234,45.5678';
            const req = mockReq({ body: { link } });
            const res = mockRes();

            // Mock fetch to just return the same URL (e.g. no redirect needed)
            global.fetch.mockResolvedValue({ url: link });

            // Act
            await UtilsController.convertMapLinkToCoords(req, res);

            // Assert
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                latitude: -10.1234,
                longitude: 45.5678,
                originalLink: link,
                resolvedUrl: link,
            });
        });

        it('should extract coordinates using Pattern 3 (/place/lat,lng/)', async () => {
            // Arrange
            const link = 'https://goo.gl/maps/abc';
            const resolvedUrl = 'https://www.google.com/maps/place/6.9271,79.8612/data=!4m2!3m1';
            const req = mockReq({ body: { link } });
            const res = mockRes();

            global.fetch.mockResolvedValue({ url: resolvedUrl });

            // Act
            await UtilsController.convertMapLinkToCoords(req, res);

            // Assert
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                latitude: 6.9271,
                longitude: 79.8612,
                originalLink: link,
                resolvedUrl: resolvedUrl,
            });
        });

        it('should extract coordinates using Pattern 4 (/search/lat,lng/)', async () => {
            // Arrange
            const link = 'https://maps.app.goo.gl/search123';
            const resolvedUrl = 'https://www.google.com/maps/search/1.2345,-5.6789/data';
            const req = mockReq({ body: { link } });
            const res = mockRes();

            global.fetch.mockResolvedValue({ url: resolvedUrl });

            // Act
            await UtilsController.convertMapLinkToCoords(req, res);

            // Assert
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                latitude: 1.2345,
                longitude: -5.6789,
            }));
        });

        // ==========================================
        // FALLBACK & ERROR LOGIC TESTS
        // ==========================================

        it('should fallback to the original link and extract coordinates if fetch throws an error', async () => {
            // Arrange
            const link = 'https://maps.google.com/?q=20.5,-30.5';
            const req = mockReq({ body: { link } });
            const res = mockRes();
            
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            global.fetch.mockRejectedValue(new Error('Network failure'));

            // Act
            await UtilsController.convertMapLinkToCoords(req, res);

            // Assert
            expect(warnSpy).toHaveBeenCalledWith(
                'Could not fetch the URL, proceeding with the original link:',
                'Network failure'
            );
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                latitude: 20.5,
                longitude: -30.5,
                resolvedUrl: link, // Uses the original link as resolvedUrl
            }));

            // Cleanup
            warnSpy.mockRestore();
        });

        it('should return 400 if no coordinates can be parsed from the resolved URL', async () => {
            // Arrange
            const link = 'https://maps.google.com/unknown-format';
            const req = mockReq({ body: { link } });
            const res = mockRes();

            global.fetch.mockResolvedValue({ url: link });

            // Act
            await UtilsController.convertMapLinkToCoords(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Could not extract coordinates from the provided link.',
                resolvedUrl: link,
            });
        });

        it('should return 500 and log an error if an unexpected exception occurs', async () => {
            // Arrange
            // Passing a null request object will trigger a TypeError when attempting to destructure `req.body`
            const req = null;
            const res = mockRes();
            
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // Act
            await UtilsController.convertMapLinkToCoords(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to convert map link to coordinates' });
            expect(errorSpy).toHaveBeenCalledWith('Error converting map link:', expect.any(TypeError));

            // Cleanup
            errorSpy.mockRestore();
        });
    });
});