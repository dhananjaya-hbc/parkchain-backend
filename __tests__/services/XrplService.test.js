// __tests__/services/XrplService.test.js

// Mock the xrpl package
jest.mock('xrpl', () => ({
    Client: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
        request: jest.fn(),
        autofill: jest.fn(),
        submitAndWait: jest.fn(),
    })),
    Wallet: {
        fromSeed: jest.fn().mockReturnValue({
            address: 'rAdminWalletAddress',
            sign: jest.fn().mockReturnValue({
                tx_blob: 'signed_blob',
                hash: 'TX_HASH_123',
            }),
        }),
    },
    dropsToXrp: jest.fn((drops) => String(Number(drops) / 1000000)),
    xrpToDrops: jest.fn((xrp) => String(Number(xrp) * 1000000)),
}));

const xrpl = require('xrpl');

describe('XrplService', () => {

    let service;
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Fresh instance for each test
        const XrplService = require('../../src/services/XrplService');
        service = XrplService;

        mockClient = new xrpl.Client();
        service.client = mockClient;
    });

    // ============================================
    // GET BALANCE
    // ============================================
    describe('getBalance()', () => {

        it('should return XRP balance for a wallet', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockResolvedValue({
                result: {
                    account_data: { Balance: '25500000' }, // 25.5 XRP in drops
                },
            });

            const balance = await service.getBalance('rTestWallet123');

            expect(balance).toBe('25.5');
            expect(mockClient.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'account_info',
                    account: 'rTestWallet123',
                })
            );
        });

        it('should return 0 for unfunded wallet', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockRejectedValue({
                data: { error: 'actNotFound' },
            });

            const balance = await service.getBalance('rUnfundedWallet');

            expect(balance).toBe('0');
        });
    });

    // ============================================
    // VERIFY DRIVER PAYMENT
    // ============================================
    describe('verifyDriverPayment()', () => {

        beforeEach(() => {
            process.env.ADMIN_WALLET_ADDRESS = 'rAdminWallet123';
        });

        it('should return success for valid payment to admin', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockResolvedValue({
                result: {
                    hash: 'TX_HASH_123',
                    Account: 'rDriverWallet',
                    Destination: 'rAdminWallet123',
                    Amount: '10500000', // 10.5 XRP
                    meta: {
                        TransactionResult: 'tesSUCCESS',
                    },
                },
            });

            const result = await service.verifyDriverPayment('TX_HASH_123');

            expect(result.success).toBe(true);
            expect(result.amountXrp).toBe('10.5');
        });

        it('should return failure if not sent to admin wallet', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockResolvedValue({
                result: {
                    hash: 'TX_HASH_123',
                    Account: 'rDriverWallet',
                    Destination: 'rWrongWallet', // wrong destination
                    Amount: '10500000',
                    meta: {
                        TransactionResult: 'tesSUCCESS',
                    },
                },
            });

            const result = await service.verifyDriverPayment('TX_HASH_123');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Not sent to admin');
        });

        it('should return failure for failed transaction', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockResolvedValue({
                result: {
                    hash: 'TX_HASH_FAILED',
                    Account: 'rDriverWallet',
                    Destination: 'rAdminWallet123',
                    Amount: '10500000',
                    meta: {
                        TransactionResult: 'tecINSUFF_FEE',
                    },
                },
            });

            const result = await service.verifyDriverPayment('TX_HASH_FAILED');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Transaction failed');
        });

        it('should return failure for invalid hash', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockRejectedValue(
                new Error('txnNotFound')
            );

            const result = await service.verifyDriverPayment('INVALID_HASH');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Invalid hash');
        });
    });

    // ============================================
    // PAY SELLER (80% split)
    // ============================================
    describe('paySeller()', () => {

        beforeEach(() => {
            process.env.ADMIN_WALLET_SEED = 'sAdminSeed123';
        });

        it('should successfully pay seller', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.autofill.mockResolvedValue({ prepared: 'tx' });
            mockClient.submitAndWait.mockResolvedValue({
                result: {
                    meta: { TransactionResult: 'tesSUCCESS' },
                },
            });

            const result = await service.paySeller(
                'rSellerWallet123',
                8.0,
                'booking-uuid'
            );

            expect(result.success).toBe(true);
            expect(result.txHash).toBe('TX_HASH_123');
        });

        it('should return failure if payment fails on chain', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.autofill.mockResolvedValue({ prepared: 'tx' });
            mockClient.submitAndWait.mockResolvedValue({
                result: {
                    meta: { TransactionResult: 'tecINSUFF_FEE' },
                },
            });

            const result = await service.paySeller(
                'rSellerWallet123',
                8.0,
                'booking-uuid'
            );

            expect(result.success).toBe(false);
        });

        it('should throw error if ADMIN_WALLET_SEED not set', async () => {
            delete process.env.ADMIN_WALLET_SEED;

            await expect(
                service.paySeller('rSellerWallet123', 8.0, 'booking-uuid')
            ).rejects.toThrow('ADMIN_WALLET_SEED not set in .env!');
        });
    });
    // ADD inside describe('XrplService')

    // ============================================
    // CONNECT / DISCONNECT
    // ============================================
 // REPLACE connect() and disconnect() describe block with this:

describe('connect() and disconnect()', () => {

  it('should skip connect if already connected', async () => {
    // Already connected - connect() should do nothing
    mockClient.isConnected.mockReturnValue(true);
    service.client = mockClient;
    mockClient.connect.mockClear();

    await service.connect();

    // connect() on client should NOT be called
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it('should disconnect when connected', async () => {
    mockClient.isConnected.mockReturnValue(true);
    service.client = mockClient;
    mockClient.disconnect.mockClear();

    await service.disconnect();

    expect(mockClient.disconnect).toHaveBeenCalled();
  });

  it('should skip disconnect if not connected', async () => {
    mockClient.isConnected.mockReturnValue(false);
    service.client = mockClient;
    mockClient.disconnect.mockClear();

    await service.disconnect();

    expect(mockClient.disconnect).not.toHaveBeenCalled();
  });

  it('should skip disconnect if client is null', async () => {
    service.client = null;

    // Should not throw
    await expect(service.disconnect()).resolves.not.toThrow();
  });
});

    // ============================================
    // VERIFY TRANSACTION (generic)
    // ============================================
    describe('verifyTransaction()', () => {

        it('should return success for valid transaction', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockResolvedValue({
                result: {
                    hash: 'TX_HASH_123',
                    Account: 'rSender',
                    Destination: 'rReceiver',
                    Amount: '5000000', // 5 XRP
                    meta: {
                        TransactionResult: 'tesSUCCESS',
                    },
                },
            });

            const result = await service.verifyTransaction('TX_HASH_123');

            expect(result.exists).toBe(true);
            expect(result.success).toBe(true);
            expect(result.from).toBe('rSender');
            expect(result.to).toBe('rReceiver');
            expect(result.amountXrp).toBe('5');
        });

        it('should return exists false for invalid hash', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockRejectedValue(new Error('txnNotFound'));

            const result = await service.verifyTransaction('INVALID_HASH');

            expect(result.exists).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should return success false for failed transaction', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockResolvedValue({
                result: {
                    hash: 'TX_FAILED',
                    Account: 'rSender',
                    Destination: 'rReceiver',
                    Amount: '5000000',
                    meta: {
                        TransactionResult: 'tecINSUFF_FEE',
                    },
                },
            });

            const result = await service.verifyTransaction('TX_FAILED');

            expect(result.exists).toBe(true);
            expect(result.success).toBe(false);
        });
    });

    // ============================================
    // GET BALANCE - additional cases
    // ============================================
    describe('getBalance() - additional', () => {

        it('should throw for non-actNotFound errors', async () => {
            mockClient.isConnected.mockReturnValue(true);
            mockClient.request.mockRejectedValue({
                data: { error: 'serverError' }, // not actNotFound
            });

            await expect(
                service.getBalance('rTestWallet')
            ).rejects.toBeDefined();
        });
    });
});