// __tests__/controllers/UtilsController.test.js

const { convertMapLinkToCoords } = require('../../src/controllers/UtilsController');

describe('UtilsController', () => {
  const mockReq = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    ...overrides,
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  describe('convertMapLinkToCoords()', () => {
    it('should return 400 when link is missing', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await convertMapLinkToCoords(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Map link is required' })
      );
    });

    it('should extract coordinates from a Google Maps @ link', async () => {
      const req = mockReq({
        body: { link: 'https://www.google.com/maps/@6.9271,79.8612,15z' },
      });
      const res = mockRes();

      global.fetch.mockResolvedValue({
        url: 'https://www.google.com/maps/@6.9271,79.8612,15z',
      });

      await convertMapLinkToCoords(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          latitude: 6.9271,
          longitude: 79.8612,
          originalLink: 'https://www.google.com/maps/@6.9271,79.8612,15z',
        })
      );
    });

    it('should extract coordinates from q parameter links', async () => {
      const req = mockReq({
        body: { link: 'https://maps.google.com/?q=6.9271,79.8612' },
      });
      const res = mockRes();

      global.fetch.mockResolvedValue({
        url: 'https://maps.google.com/?q=6.9271,79.8612',
      });

      await convertMapLinkToCoords(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          latitude: 6.9271,
          longitude: 79.8612,
        })
      );
    });

    it('should return 400 when coordinates cannot be extracted', async () => {
      const req = mockReq({
        body: { link: 'https://example.com/not-a-map-link' },
      });
      const res = mockRes();

      global.fetch.mockResolvedValue({
        url: 'https://example.com/not-a-map-link',
      });

      await convertMapLinkToCoords(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Could not extract coordinates from the provided link.',
        })
      );
    });

    it('should continue with original link if fetch fails', async () => {
      const req = mockReq({
        body: { link: 'https://www.google.com/maps/@6.9271,79.8612,15z' },
      });
      const res = mockRes();

      global.fetch.mockRejectedValue(new Error('Network error'));

      await convertMapLinkToCoords(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          latitude: 6.9271,
          longitude: 79.8612,
        })
      );
    });
  });
});
