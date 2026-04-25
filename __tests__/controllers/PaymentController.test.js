// __tests__/controllers/PaymentController.test.js

require('../mocks/xrpl.mock');

jest.mock('../../src/models/Transaction');
jest.mock('../../src/models/User');

const xrplService = require('../../src/services/XrplService');
const Transaction = require('../../src/models/Transaction');
const User = require('../../src/models/User');
const {
    getBalance,
    getAdminBalance,
    getTransactions,
    getSellerTransactions,
    getSellerEarningsChart,
    verifyTransaction,
} = require('../../src/controllers/PaymentController');

// ── Helpers ───────────────────────────────────────────
const mockReq = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    user: { id: 'user-uuid', role: 'driver' },
    ...overrides,
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('PaymentController', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ADMIN_WALLET_ADDRESS = 'rAdminWallet123';
    });

    // ============================================
    // GET BALANCE
    // ============================================
    describe('getBalance()', () => {

        it('should return wallet balance', async () => {
            const req = mockReq();
            const res = mockRes();

            User.getWalletAddress.mockResolvedValue('rDriverWallet123');
            xrplService.getBalance.mockResolvedValue('25.5');

            await getBalance(req, res);

            expect(res.json).toHaveBeenCalledWith({
                walletAddress: 'rDriverWallet123',
                balanceXrp: '25.5',
            });
        });

        it('should return 400 if no wallet linked', async () => {
            const req = mockReq();
            const res = mockRes();

            User.getWalletAddress.mockResolvedValue(null);

            await getBalance(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'NO_WALLET' })
            );
        });

        it('should return 500 on XRPL error', async () => {
            const req = mockReq();
            const res = mockRes();

            User.getWalletAddress.mockResolvedValue('rDriverWallet123');
            xrplService.getBalance.mockRejectedValue(
                new Error('XRPL connection failed')
            );

            await getBalance(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    // ============================================
    // GET ADMIN BALANCE
    // ============================================
    describe('getAdminBalance()', () => {

        it('should return admin balance and earnings', async () => {
            const req = mockReq({ user: { id: 'admin-uuid', role: 'admin' } });
            const res = mockRes();

            xrplService.getBalance.mockResolvedValue('1000.5');
            Transaction.getAdminEarnings.mockResolvedValue({
                total_payments: '50',
                total_received_xrp: '500.0',
                total_paid_sellers_xrp: '400.0',
                admin_profit_xrp: '100.0',
            });

            await getAdminBalance(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    adminWallet: 'rAdminWallet123',
                    currentBalance: '1000.5',
                    earnings: expect.objectContaining({
                        admin_profit_xrp: '100.0',
                    }),
                })
            );
        });

        it('should return 500 if admin wallet not configured', async () => {
            delete process.env.ADMIN_WALLET_ADDRESS;

            const req = mockReq({ user: { role: 'admin' } });
            const res = mockRes();

            await getAdminBalance(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Admin wallet not configured.' })
            );
        });
    });

    // ============================================
    // GET TRANSACTIONS (ADMIN)
    // ============================================
    describe('getTransactions()', () => {

        it('should return all transactions for admin', async () => {
            const req = mockReq({
                user: { id: 'admin-uuid', role: 'admin' },
                query: {},
            });
            const res = mockRes();

            Transaction.findAll.mockResolvedValue([
                { id: 'tx-1', tx_type: 'driver_to_admin' },
                { id: 'tx-2', tx_type: 'admin_to_seller' },
            ]);

            await getTransactions(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ total: 2 })
            );
        });

        it('should filter by bookingId when provided', async () => {
            const req = mockReq({
                user: { id: 'admin-uuid', role: 'admin' },
                query: { bookingId: 'booking-uuid' },
            });
            const res = mockRes();

            Transaction.findByBooking.mockResolvedValue([
                { id: 'tx-1', booking_id: 'booking-uuid' },
            ]);

            await getTransactions(req, res);

            expect(Transaction.findByBooking).toHaveBeenCalledWith('booking-uuid');
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ total: 1 })
            );
        });

        it('should use limit and offset from query params', async () => {
            const req = mockReq({
                user: { id: 'admin-uuid', role: 'admin' },
                query: { limit: '10', offset: '5' },
            });
            const res = mockRes();

            Transaction.findAll.mockResolvedValue([]);

            await getTransactions(req, res);

            expect(Transaction.findAll).toHaveBeenCalledWith(10, 5);
        });
    });

    // ============================================
    // VERIFY TRANSACTION
    // ============================================
    describe('verifyTransaction()', () => {

        it('should return transaction details for valid hash', async () => {
            const req = mockReq({ params: { txHash: 'VALID_TX_HASH_123' } });
            const res = mockRes();

            xrplService.verifyTransaction.mockResolvedValue({
                exists: true,
                success: true,
                from: 'rDriverWallet',
                to: 'rAdminWallet',
                amountXrp: '10.5',
            });

            await verifyTransaction(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    transaction: expect.objectContaining({
                        success: true,
                        from: 'rDriverWallet',
                    }),
                })
            );
        });

        it('should handle invalid transaction hash', async () => {
            const req = mockReq({ params: { txHash: 'INVALID_HASH' } });
            const res = mockRes();

            xrplService.verifyTransaction.mockResolvedValue({
                exists: false,
                error: 'Transaction not found',
            });

            await verifyTransaction(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    transaction: expect.objectContaining({ exists: false }),
                })
            );
        });
    });

    // ============================================
    // GET SELLER TRANSACTIONS
    // ============================================
    describe('getSellerTransactions()', () => {

        it('should return seller transactions and earnings', async () => {
            const req = mockReq({ user: { id: 'seller-uuid', role: 'seller' } });
            const res = mockRes();

            Transaction.findBySellerId.mockResolvedValue([
                { id: 'tx-1', amount_xrp: '8.0', tx_type: 'admin_to_seller' },
                { id: 'tx-2', amount_xrp: '16.0', tx_type: 'admin_to_seller' },
            ]);
            Transaction.getSellerEarnings.mockResolvedValue({
                total_transactions: '2',
                total_earned_xrp: '24.0',
            });

            await getSellerTransactions(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    total: 2,
                    earnings: expect.objectContaining({
                        total_earned_xrp: '24.0',
                    }),
                })
            );
        });
    });

    // ============================================
    // GET SELLER EARNINGS CHART
    // ============================================
    describe('getSellerEarningsChart()', () => {

        it('should return weekly earnings chart data', async () => {
            const req = mockReq({
                user: { id: 'seller-uuid', role: 'seller' },
                query: { period: 'week' },
            });
            const res = mockRes();

            Transaction.getSellerEarningsSeries.mockResolvedValue({
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                values: [1.0, 2.0, 0.0, 3.0, 1.5, 4.0, 2.5],
            });

            await getSellerEarningsChart(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    period: 'week',
                    currency: 'XRP',
                    labels: expect.arrayContaining(['Mon', 'Sun']),
                })
            );
        });

        it('should default to week for invalid period', async () => {
            const req = mockReq({
                user: { id: 'seller-uuid', role: 'seller' },
                query: { period: 'invalid' },
            });
            const res = mockRes();

            Transaction.getSellerEarningsSeries.mockResolvedValue({
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                values: [0, 0, 0, 0, 0, 0, 0],
            });

            await getSellerEarningsChart(req, res);

            expect(Transaction.getSellerEarningsSeries).toHaveBeenCalledWith(
                'seller-uuid',
                'week'
            );
        });

        it('should return monthly chart data', async () => {
            const req = mockReq({
                user: { id: 'seller-uuid', role: 'seller' },
                query: { period: 'month' },
            });
            const res = mockRes();

            Transaction.getSellerEarningsSeries.mockResolvedValue({
                labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
                values: [5.0, 10.0, 8.0, 12.0],
            });

            await getSellerEarningsChart(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ period: 'month' })
            );
        });
    });
    // ADD inside describe('PaymentController')

    // ============================================
    // ERROR HANDLING - uncovered lines 104-105, 125-126
    // ============================================
    describe('getSellerTransactions() - error handling', () => {

        it('should return 500 on unexpected error', async () => {
            const req = mockReq({
                user: { id: 'seller-uuid', role: 'seller' },
            });
            const res = mockRes();

            Transaction.findBySellerId.mockRejectedValue(
                new Error('DB connection failed')
            );

            await getSellerTransactions(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Failed to fetch seller transactions.',
                })
            );
        });
    });

    describe('getSellerEarningsChart() - error handling', () => {

        it('should return 500 on unexpected error', async () => {
            const req = mockReq({
                user: { id: 'seller-uuid', role: 'seller' },
                query: { period: 'week' },
            });
            const res = mockRes();

            Transaction.getSellerEarningsSeries.mockRejectedValue(
                new Error('DB error')
            );

            await getSellerEarningsChart(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Failed to fetch seller earnings chart.',
                })
            );
        });
    });

    describe('getAdminBalance() - error handling', () => {

        it('should return 500 on XRPL error', async () => {
            const req = mockReq({ user: { role: 'admin' } });
            const res = mockRes();

            process.env.ADMIN_WALLET_ADDRESS = 'rAdminWallet123';
            xrplService.getBalance.mockRejectedValue(
                new Error('XRPL network error')
            );

            await getAdminBalance(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getTransactions() - error handling', () => {

        it('should return 500 on DB error', async () => {
            const req = mockReq({
                user: { id: 'admin-uuid', role: 'admin' },
                query: {},
            });
            const res = mockRes();

            Transaction.findAll.mockRejectedValue(new Error('DB error'));

            await getTransactions(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('verifyTransaction() - error handling', () => {

        it('should return 500 on XRPL error', async () => {
            const req = mockReq({ params: { txHash: 'SOME_HASH' } });
            const res = mockRes();

            xrplService.verifyTransaction.mockRejectedValue(
                new Error('XRPL error')
            );

            await verifyTransaction(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
}); // ← end describe('PaymentController')