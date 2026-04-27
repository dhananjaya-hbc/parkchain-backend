// __tests__/controllers/KybController.test.js

jest.mock('../../src/models/KybSubmission');

const KybController = require('../../src/controllers/KybController');
const KybSubmission = require('../../src/models/KybSubmission');

const mockReq = (overrides = {}) => ({
    user: { id: 'user-123' },
    body: {},
    file: undefined,
    ...overrides,
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('KybController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('submitKyb()', () => {
        it('should successfully submit a KYB application', async () => {
            const req = mockReq({
                body: {
                    entityName: 'Test Business',
                    address: '123 Main St',
                    googleMapsLink: 'https://maps.app.goo.gl/123',
                    spotType: 'garage'
                },
                file: {
                    path: 'https://cloudinary.com/doc123.pdf'
                }
            });
            const res = mockRes();

            const mockSubmission = { id: 'kyb-123', status: 'pending' };
            KybSubmission.create.mockResolvedValue(mockSubmission);

            await KybController.submitKyb(req, res);

            expect(KybSubmission.create).toHaveBeenCalledWith({
                ownerId: 'user-123',
                entityName: 'Test Business',
                address: '123 Main St',
                googleMapsLink: 'https://maps.app.goo.gl/123',
                spotType: 'garage',
                documentUrl: 'https://cloudinary.com/doc123.pdf'
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: 'KYB submission successful.',
                submission: mockSubmission
            });
        });

        it('should return 400 if required text fields are missing', async () => {
            const req = mockReq({
                body: {
                    entityName: 'Test Business',
                    // address is missing
                    spotType: 'garage'
                },
                file: {
                    path: 'https://cloudinary.com/doc123.pdf'
                }
            });
            const res = mockRes();

            await KybController.submitKyb(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing required text fields for KYB.' });
            expect(KybSubmission.create).not.toHaveBeenCalled();
        });

        it('should return 400 if document file is missing', async () => {
            const req = mockReq({
                body: {
                    entityName: 'Test Business',
                    address: '123 Main St',
                    spotType: 'garage'
                }
                // file is missing
            });
            const res = mockRes();

            await KybController.submitKyb(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Document file is required for KYB.' });
            expect(KybSubmission.create).not.toHaveBeenCalled();
        });

        it('should return 400 if document file path is missing', async () => {
            const req = mockReq({
                body: { entityName: 'Test', address: '123 St', spotType: 'open' },
                file: { originalname: 'doc.pdf' } // path missing
            });
            const res = mockRes();

            await KybController.submitKyb(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Document file is required for KYB.' });
        });

        it('should return 500 on database error', async () => {
            const req = mockReq({
                body: { entityName: 'Test', address: '123 St', spotType: 'garage' },
                file: { path: 'https://cloudinary.com/doc.pdf' }
            });
            const res = mockRes();

            KybSubmission.create.mockRejectedValue(new Error('DB connection failed'));

            await KybController.submitKyb(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error during KYB submission.' });
        });
    });
});