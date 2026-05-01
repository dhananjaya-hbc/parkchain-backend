// __tests__/services/XummService.test.js

// Mock the official Xumm SDK
const mockPayloadCreate = jest.fn();
const mockPayloadGet = jest.fn();

jest.mock('xumm-sdk', () => {
  return {
    XummSdk: jest.fn().mockImplementation(() => ({
      payload: {
        create: mockPayloadCreate,
        get: mockPayloadGet
      }
    }))
  };
});

const XummService = require('../../src/services/XummService');

describe('XummService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Optional: Hide expected console.errors during test runs to keep terminal clean
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  // ============================================
  // createSignInPayload()
  // ============================================
  describe('createSignInPayload()', () => {
    it('should successfully create a sign-in payload and return mapped URLs', async () => {
      const mockSdkResponse = {
        uuid: 'sign-in-uuid-123',
        next: { always: 'https://xumm.app/sign/sign-in-uuid-123' },
        refs: { 
          qr_png: 'https://xumm.app/sign/qr.png',
          websocket_status: 'wss://xumm.app/ws/123'
        }
      };

      mockPayloadCreate.mockResolvedValue(mockSdkResponse);

      const result = await XummService.createSignInPayload();

      expect(mockPayloadCreate).toHaveBeenCalled();
      expect(result).toEqual({
        uuid: 'sign-in-uuid-123',
        deepLink: 'https://xumm.app/sign/sign-in-uuid-123',
        qrUrl: 'https://xumm.app/sign/qr.png',
        webSocketUrl: 'wss://xumm.app/ws/123'
      });
    });

    it('should throw an error if SDK throws during creation', async () => {
      mockPayloadCreate.mockRejectedValue(new Error('SDK Error'));
      await expect(XummService.createSignInPayload()).rejects.toThrow('SDK Error');
    });
  });

  // ============================================
  // verifyPayload()
  // ============================================
  describe('verifyPayload()', () => {
    it('should return signed: true, wallet address, and user token when signed', async () => {
      const mockSdkResponse = {
        meta: { signed: true },
        response: { account: 'rTestWallet123', user_token: 'token_123' }
      };

      mockPayloadGet.mockResolvedValue(mockSdkResponse);

      const result = await XummService.verifyPayload('payload-uuid-123');

      expect(mockPayloadGet).toHaveBeenCalledWith('payload-uuid-123');
      expect(result).toEqual({
        signed: true,
        walletAddress: 'rTestWallet123',
        userToken: 'token_123'
      });
    });

    it('should return userToken as null if not provided by SDK', async () => {
      const mockSdkResponse = {
        meta: { signed: true },
        response: { account: 'rTestWallet123' } // No user_token
      };

      mockPayloadGet.mockResolvedValue(mockSdkResponse);
      const result = await XummService.verifyPayload('payload-uuid-123');
      expect(result.userToken).toBeNull();
    });

    it('should return signed: false and reason "User cancelled" when user explicitly rejects', async () => {
      const mockSdkResponse = {
        meta: { signed: false, cancelled: true },
        response: {}
      };

      mockPayloadGet.mockResolvedValue(mockSdkResponse);

      const result = await XummService.verifyPayload('payload-uuid-123');
      expect(result).toEqual({ signed: false, reason: 'User cancelled' });
    });

    it('should return signed: false and reason "Not signed yet" when ignored/pending', async () => {
      const mockSdkResponse = {
        meta: { signed: false, cancelled: false },
        response: {}
      };

      mockPayloadGet.mockResolvedValue(mockSdkResponse);

      const result = await XummService.verifyPayload('payload-uuid-123');
      expect(result).toEqual({ signed: false, reason: 'Not signed yet' });
    });

    it('should throw an error if SDK throws during verification', async () => {
      mockPayloadGet.mockRejectedValue(new Error('Network Error'));
      await expect(XummService.verifyPayload('uuid')).rejects.toThrow('Network Error');
    });
  });

  // ============================================
  // createPaymentPayload()
  // ============================================
  describe('createPaymentPayload()', () => {
    it('should create a payment payload for the correct amount and destination', async () => {
      const mockSdkResponse = {
        uuid: 'pay-uuid-456',
        next: { always: 'https://xumm.app/pay/pay-uuid-456' },
        refs: { qr_png: 'https://xumm.app/pay/qr.png' }
      };

      mockPayloadCreate.mockResolvedValue(mockSdkResponse);

      const result = await XummService.createPaymentPayload(
        'rDriverWallet',
        'rAdminWallet',
        '10500000',
        'booking-uuid-789'
      );

      expect(result).toEqual({
        uuid: 'pay-uuid-456',
        deepLink: 'https://xumm.app/pay/pay-uuid-456',
        qrUrl: 'https://xumm.app/pay/qr.png'
      });

      const callArgs = mockPayloadCreate.mock.calls[0][0];
      expect(callArgs.txjson.TransactionType).toBe('Payment');
      expect(callArgs.txjson.Destination).toBe('rAdminWallet');
      expect(callArgs.txjson.Amount).toBe('10500000');
      expect(callArgs.txjson.Account).toBe('rDriverWallet');
    });

    it('should throw an error if SDK throws during payment creation', async () => {
      mockPayloadCreate.mockRejectedValue(new Error('Payment Error'));
      await expect(XummService.createPaymentPayload('r1','r2','10','b1')).rejects.toThrow('Payment Error');
    });
  });

  // ============================================
  // getPayloadDetails()
  // ============================================
  describe('getPayloadDetails()', () => {
    it('should fetch and return the raw payload details', async () => {
      const mockSdkDetails = {
        meta: { signed: true },
        response: { txid: 'TX_HASH_123' }
      };

      mockPayloadGet.mockResolvedValue(mockSdkDetails);

      const result = await XummService.getPayloadDetails('test-uuid-123');

      expect(mockPayloadGet).toHaveBeenCalledWith('test-uuid-123');
      expect(result).toEqual(mockSdkDetails);
    });

    it('should return null (not throw) if fetching payload details fails', async () => {
      mockPayloadGet.mockRejectedValue(new Error('Cannot find payload'));
      
      const result = await XummService.getPayloadDetails('bad-uuid');
      
      // The method swallows the error and returns null
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });
});