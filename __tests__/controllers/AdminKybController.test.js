// __tests__/controllers/AdminKybController.test.js

jest.mock('../../src/models/KybSubmission');
jest.mock('../../src/models/User');
jest.mock('../../src/config/db', () => ({
    query: jest.fn()
}));

const AdminKybController = require('../../src/controllers/AdminKybController');
const KybSubmission = require('../../src/models/KybSubmission');
const { query } = require('../../src/config/db');

const mockReq = (overrides = {}) => ({
    body: {},
    params: {},
    ...overrides,
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('AdminKybController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAllSubmissions()', () => {
        it('should return a formatted list of all submissions', async () => {
            const req = mockReq();
            const res = mockRes();

            KybSubmission.findAll.mockResolvedValue([
                {
                    id: 'kyb-1',
                    entity_name: 'Test Business',
                    spot_type: 'Commercial',
                    address: '123 Main St',
                    date: '2023-01-01',
                    status: 'approved'
                },
                {
                    id: 'kyb-2',
                    entityName: 'Test Business 2',
                    spotType: 'Residential',
                    address: '456 Side St',
                    date: '2023-01-02',
                    status: 'pending'
                }
            ]);

            await AdminKybController.getAllSubmissions(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith([
                {
                    id: 'kyb-1',
                    entityName: 'Test Business',
                    spotType: 'Commercial',
                    address: '123 Main St',
                    date: '2023-01-01',
                    status: 'verified' // maps approved to verified
                },
                {
                    id: 'kyb-2',
                    entityName: 'Test Business 2',
                    spotType: 'Residential',
                    address: '456 Side St',
                    date: '2023-01-02',
                    status: 'pending'
                }
            ]);
        });

        it('should return 500 on database error', async () => {
            const req = mockReq();
            const res = mockRes();

            KybSubmission.findAll.mockRejectedValue(new Error('DB Error'));

            await AdminKybController.getAllSubmissions(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error while fetching submissions.' });
        });
    });

    describe('getSubmissionDetails()', () => {
        it('should return submission details successfully', async () => {
            const req = mockReq({ params: { id: 'kyb-1' } });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue({
                id: 'kyb-1',
                owner_name: 'John Doe',
                entity_name: 'Test Business',
                address: '123 Main St',
                google_maps_link: 'http://maps.google.com/...',
                spot_type: 'Commercial',
                document_url: 'http://cloudinary/...',
                date: '2023-01-01',
                status: 'approved',
                admin_notes: 'All good'
            });

            await AdminKybController.getSubmissionDetails(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                id: 'kyb-1',
                ownerName: 'John Doe',
                entityName: 'Test Business',
                address: '123 Main St',
                googleMapsLink: 'http://maps.google.com/...',
                spotType: 'Commercial',
                documentUrl: 'http://cloudinary/...',
                date: '2023-01-01',
                status: 'verified', // approved maps to verified
                adminNotes: 'All good'
            });
        });

        it('should return 404 if submission not found', async () => {
            const req = mockReq({ params: { id: 'non-existent' } });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue(null);

            await AdminKybController.getSubmissionDetails(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'KYB submission not found.' });
        });

        it('should return 500 on database error', async () => {
            const req = mockReq({ params: { id: 'kyb-1' } });
            const res = mockRes();

            KybSubmission.findById.mockRejectedValue(new Error('DB Error'));

            await AdminKybController.getSubmissionDetails(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error while fetching details.' });
        });
    });

    describe('updateSubmissionStatus()', () => {
        it('should return 400 for invalid status', async () => {
            const req = mockReq({
                params: { id: 'kyb-1' },
                body: { status: 'invalid_status' }
            });
            const res = mockRes();

            await AdminKybController.updateSubmissionStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid status update. Only `verified` or `rejected` allowed.' });
        });

        it('should return 404 if submission not found', async () => {
            const req = mockReq({
                params: { id: 'non-existent' },
                body: { status: 'verified' }
            });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue(null);

            await AdminKybController.updateSubmissionStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should successfully update status to verified and trigger post-approval hooks', async () => {
            const req = mockReq({
                params: { id: 'kyb-1' },
                body: { status: 'verified', adminNotes: 'Looks legit' }
            });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue({ id: 'kyb-1', owner_id: 'user-1' });
            KybSubmission.updateStatus.mockResolvedValue({
                id: 'kyb-1',
                status: 'approved',
                admin_notes: 'Looks legit'
            });
            query.mockResolvedValue({});

            await AdminKybController.updateSubmissionStatus(req, res);

            // Verify DB update was called with internal 'approved' status
            expect(KybSubmission.updateStatus).toHaveBeenCalledWith('kyb-1', 'approved', 'Looks legit');

            // Verify post-approval hooks (2 SQL queries executed)
            expect(query).toHaveBeenCalledTimes(2);
            expect(query).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining("UPDATE users SET role = 'seller'"),
                ['user-1']
            );
            expect(query).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining("UPDATE spots SET is_approved = true"),
                ['user-1']
            );

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                id: 'kyb-1',
                status: 'verified', // mapped back for the frontend
                adminNotes: 'Looks legit'
            });
        });

        it('should successfully update status to rejected without triggering post-approval hooks', async () => {
            const req = mockReq({
                params: { id: 'kyb-2' },
                body: { status: 'rejected', adminNotes: 'Missing documents' }
            });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue({ id: 'kyb-2', owner_id: 'user-2' });
            KybSubmission.updateStatus.mockResolvedValue({
                id: 'kyb-2',
                status: 'rejected',
                admin_notes: 'Missing documents'
            });

            await AdminKybController.updateSubmissionStatus(req, res);

            expect(KybSubmission.updateStatus).toHaveBeenCalledWith('kyb-2', 'rejected', 'Missing documents');
            expect(query).not.toHaveBeenCalled(); // No raw SQL queries should trigger

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                id: 'kyb-2',
                status: 'rejected',
                adminNotes: 'Missing documents'
            });
        });

        it('should return 500 on database error during update', async () => {
            const req = mockReq({
                params: { id: 'kyb-1' },
                body: { status: 'verified' }
            });
            const res = mockRes();

            KybSubmission.findById.mockResolvedValue({ id: 'kyb-1', owner_id: 'user-1' });
            KybSubmission.updateStatus.mockRejectedValue(new Error('DB Error'));

            await AdminKybController.updateSubmissionStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error while updating status.' });
        });
    });
});