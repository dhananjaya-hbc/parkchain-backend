// __tests__/controllers/SellerKybController.test.js

jest.mock('../../src/models/KybSubmission');
jest.mock('../../src/models/Spot');

const SellerKybController = require('../../src/controllers/SellerKybController');
const KybSubmission = require('../../src/models/KybSubmission');
const Spot = require('../../src/models/Spot');

const mockReq = (overrides = {}) => ({
    user: { id: 'seller-123' },
    params: {},
    ...overrides,
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('SellerKybController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================
    // getMyRequests()
    // ============================================
    describe('getMyRequests()', () => {
        it('should fetch and format all KYB requests for the seller', async () => {
            const req = mockReq();
            const res = mockRes();

            KybSubmission.findByOwnerId.mockResolvedValue([
                { id: 'kyb-1', entity_name: 'Biz 1', status: 'approved', admin_notes: 'Looks good' },
                { id: 'kyb-2', entity_name: 'Biz 2', status: 'pending', admin_notes: null },
                { id: 'kyb-3', entity_name: 'Biz 3', status: 'rejected', admin_notes: 'Missing doc' }
            ]);

            await SellerKybController.getMyRequests(req, res);

            expect(KybSubmission.findByOwnerId).toHaveBeenCalledWith('seller-123');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith([
                { id: 'kyb-1', entityName: 'Biz 1', status: 'verified', adminNotes: 'Looks good' },
                { id: 'kyb-2', entityName: 'Biz 2', status: 'pending', adminNotes: '' },
                { id: 'kyb-3', entityName: 'Biz 3', status: 'rejected', adminNotes: 'Missing doc' }
            ]);
        });

        it('should return 500 on database error', async () => {
            const req = mockReq();
            const res = mockRes();

            KybSubmission.findByOwnerId.mockRejectedValue(new Error('DB Error'));

            await SellerKybController.getMyRequests(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error while fetching seller requests.' });
        });
    });

    // ============================================
    // getApprovedRequests()
    // ============================================
    describe('getApprovedRequests()', () => {
        it('should fetch only approved requests and check spot creation status', async () => {
            const req = mockReq();
            const res = mockRes();

            KybSubmission.findByOwnerId.mockResolvedValue([
                { id: 'kyb-1', entity_name: 'Biz 1', address: '123 St', status: 'approved', admin_notes: 'OK' },
                { id: 'kyb-2', entity_name: 'Biz 2', address: '456 St', status: 'pending' },
                { id: 'kyb-3', entity_name: 'Biz 3', address: '789 St', status: 'approved', admin_notes: null }
            ]);

            // Mock Spot.findByKybSubmissionId mapping
            Spot.findByKybSubmissionId.mockImplementation(async (id) => {
                if (id === 'kyb-1') return { id: 'spot-1' }; // Spot created
                if (id === 'kyb-3') return null; // Spot not created
                return null;
            });

            await SellerKybController.getApprovedRequests(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith([
                {
                    id: 'kyb-1',
                    name: 'Biz 1',
                    address: '123 St',
                    status: 'verified',
                    spotCreated: true,
                    adminNotes: 'OK',
                    entityName: 'Biz 1'
                },
                {
                    id: 'kyb-3',
                    name: 'Biz 3',
                    address: '789 St',
                    status: 'verified',
                    spotCreated: false,
                    adminNotes: '',
                    entityName: 'Biz 3'
                }
            ]);
        });

        it('should return 500 on database error', async () => {
            const req = mockReq();
            const res = mockRes();

            KybSubmission.findByOwnerId.mockRejectedValue(new Error('DB Error'));

            await SellerKybController.getApprovedRequests(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error while fetching approved KYB requests.' });
        });
    });

    // ============================================
    // getKybById()
    // ============================================
    describe('getKybById()', () => {
        it('should return 404 if KYB is not found', async () => {
            const req = mockReq({ params: { kybId: 'non-existent' } });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue(null);

            await SellerKybController.getKybById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'KYB submission not found.' });
        });

        it('should return 404 if KYB is found but belongs to another user', async () => {
            const req = mockReq({ params: { kybId: 'kyb-1' } });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue({ id: 'kyb-1', owner_id: 'other-user-456' });

            await SellerKybController.getKybById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'KYB submission not found.' });
        });

        it('should return 403 if KYB is owned but not approved', async () => {
            const req = mockReq({ params: { kybId: 'kyb-1' } });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue({ id: 'kyb-1', owner_id: 'seller-123', status: 'pending' });

            await SellerKybController.getKybById(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'KYB not approved.' });
        });

        it('should return autofill details for an approved KYB', async () => {
            const req = mockReq({ params: { kybId: 'kyb-1' } });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue({
                id: 'kyb-1',
                owner_id: 'seller-123',
                status: 'approved',
                entity_name: 'Test Biz',
                address: '123 Main St',
                google_maps_link: 'http://maps...'
            });

            await SellerKybController.getKybById(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                kybId: 'kyb-1',
                name: 'Test Biz',
                address: '123 Main St',
                googleMapsLink: 'http://maps...',
                entityName: 'Test Biz'
            });
        });

        it('should return 500 on database error', async () => {
            const req = mockReq({ params: { kybId: 'kyb-1' } });
            const res = mockRes();

            KybSubmission.findById.mockRejectedValue(new Error('DB Error'));

            await SellerKybController.getKybById(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error while fetching KYB.' });
        });
    });
});