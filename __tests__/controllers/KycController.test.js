// __tests__/controllers/KycController.test.js

jest.mock('../../src/config/db', () => ({
    query: jest.fn()
}));
jest.mock('../../src/models/User');

const KycController = require('../../src/controllers/KycController');
const { query } = require('../../src/config/db');
const User = require('../../src/models/User');

const mockReq = (overrides = {}) => ({
    user: { id: 'user-123' },
    headers: {},
    query: {},
    body: {},
    ...overrides,
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('KycController', () => {
    let originalEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        
        // Save and mock env vars
        originalEnv = process.env;
        process.env = { 
            ...originalEnv, 
            DIDIT_API_KEY: 'test-api-key',
            WORKFLOW_ID: 'test-workflow-id',
            DIDIT_WEBHOOK_SECRET: 'test-secret'
        };
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    // ============================================
    // createSession()
    // ============================================
    describe('createSession()', () => {
        it('should return 500 if Didit config is missing', async () => {
            delete process.env.DIDIT_API_KEY;
            const req = mockReq();
            const res = mockRes();

            await KycController.createSession(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Didit configuration missing in environment' });
        });

        it('should successfully create a session and update the DB', async () => {
            const req = mockReq({ headers: { origin: 'http://my-frontend.com' } });
            const res = mockRes();

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ session_id: 'session-123', url: 'https://verify.didit.me/session-123' })
            });

            query.mockResolvedValue({});

            await KycController.createSession(req, res);

            expect(global.fetch).toHaveBeenCalledWith(
                'https://verification.didit.me/v3/session/',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'x-api-key': 'test-api-key', 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workflow_id: 'test-workflow-id',
                        callback: 'http://my-frontend.com/kyc-success',
                        vendor_data: 'user-123'
                    })
                })
            );

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users'),
                ['session-123', 'user-123']
            );

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ didit_url: 'https://verify.didit.me/session-123' });
        });

        it('should handle Didit API failure properly', async () => {
            const req = mockReq();
            const res = mockRes();

            global.fetch.mockResolvedValue({
                ok: false,
                status: 400,
                text: async () => 'Bad Request Details'
            });

            await KycController.createSession(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Failed to create KYC session with Didit',
                details: 'Bad Request Details',
                status: 400
            });
            expect(query).not.toHaveBeenCalled();
        });

        it('should return 500 on unexpected errors', async () => {
            const req = mockReq();
            const res = mockRes();

            global.fetch.mockRejectedValue(new Error('Network error'));

            await KycController.createSession(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Internal server error while creating KYC session',
                details: 'Network error'
            });
        });
    });

    // ============================================
    // checkSessionStatus()
    // ============================================
    describe('checkSessionStatus()', () => {
        it('should manually update status if status param is provided (local dev bypass)', async () => {
            const req = mockReq({ query: { status: 'Approved', session: 'session-bypass' } });
            const res = mockRes();

            query.mockResolvedValue({});

            await KycController.checkSessionStatus(req, res);

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET kyc_status'),
                ['APPROVED', 'session-bypass', 'user-123']
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ kyc_status: 'APPROVED' });
        });

        it('should return current unverified status if no session exists', async () => {
            const req = mockReq();
            const res = mockRes();

            User.findById.mockResolvedValue({ id: 'user-123', kyc_status: 'unverified', kyc_session_id: null });

            await KycController.checkSessionStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ kyc_status: 'unverified' });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should fetch status from Didit and update DB if status is APPROVED', async () => {
            const req = mockReq();
            const res = mockRes();

            User.findById.mockResolvedValue({ id: 'user-123', kyc_status: 'pending', kyc_session_id: 'session-123' });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'Approved' })
            });

            query.mockResolvedValue({});

            await KycController.checkSessionStatus(req, res);

            expect(global.fetch).toHaveBeenCalledWith(
                'https://verification.didit.me/v3/session/session-123/',
                expect.objectContaining({ 
                    method: 'GET',
                    headers: { 'x-api-key': 'test-api-key', 'Content-Type': 'application/json' } 
                })
            );

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET kyc_status'),
                ['APPROVED', 'user-123']
            );

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                kyc_status: 'APPROVED',
                didit_status: 'Approved'
            });
        });

        it('should not update DB if Didit status is IN_PROGRESS', async () => {
            const req = mockReq();
            const res = mockRes();

            User.findById.mockResolvedValue({ id: 'user-123', kyc_status: 'pending', kyc_session_id: 'session-123' });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'In Progress' })
            });

            await KycController.checkSessionStatus(req, res);

            expect(query).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                kyc_status: 'IN PROGRESS',
                didit_status: 'In Progress'
            });
        });

        it('should return 502 if Didit fetch fails', async () => {
            const req = mockReq();
            const res = mockRes();

            User.findById.mockResolvedValue({ id: 'user-123', kyc_status: 'pending', kyc_session_id: 'session-123' });

            global.fetch.mockResolvedValue({ ok: false });

            await KycController.checkSessionStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(502);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch status from Didit' });
        });

        it('should return 500 on unexpected errors', async () => {
            const req = mockReq();
            const res = mockRes();

            User.findById.mockRejectedValue(new Error('DB Error'));

            await KycController.checkSessionStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Internal server error while checking KYC',
                details: 'DB Error'
            });
        });
    });

    // ============================================
    // handleWebhook()
    // ============================================
    describe('handleWebhook()', () => {
        it('should return 401 if signature is missing or invalid', async () => {
            const req = mockReq({ headers: { 'x-didit-signature': 'wrong-secret' } });
            const res = mockRes();

            await KycController.handleWebhook(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
        });

        it('should return 400 if session identifiers are missing', async () => {
            const req = mockReq({
                headers: { 'x-didit-signature': 'test-secret' },
                body: { status: 'APPROVED' } // missing session_id or vendor_data
            });
            const res = mockRes();

            await KycController.handleWebhook(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing session identifiers in webhook body' });
        });

        it('should update DB via vendor_data if status is APPROVED', async () => {
            const req = mockReq({
                headers: { 'x-didit-signature': 'test-secret' },
                body: { session_id: 'session-123', vendor_data: 'user-123', status: 'APPROVED' }
            });
            const res = mockRes();

            query.mockResolvedValue({});

            await KycController.handleWebhook(req, res);

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('kyc_status = \'APPROVED\''),
                ['session-123', 'user-123']
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ received: true });
        });

        it('should update DB via session_id if vendor_data is missing and status is APPROVED', async () => {
            const req = mockReq({
                headers: { 'authorization': 'Bearer test-secret' }, // Testing secondary header check
                body: { session_id: 'session-123', status: 'APPROVED' }
            });
            const res = mockRes();

            query.mockResolvedValue({});

            await KycController.handleWebhook(req, res);

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE kyc_session_id = $1'),
                ['session-123']
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should update DB to DECLINED if status is DECLINED', async () => {
            const req = mockReq({
                headers: { 'x-didit-signature': 'test-secret' },
                body: { session_id: 'session-123', vendor_data: 'user-123', status: 'DECLINED' }
            });
            const res = mockRes();

            query.mockResolvedValue({});

            await KycController.handleWebhook(req, res);

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET kyc_status'),
                ['user-123', 'DECLINED']
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });
});