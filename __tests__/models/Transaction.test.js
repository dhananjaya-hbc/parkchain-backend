// __tests__/models/Transaction.test.js

const { mockQuery } = require('../mocks/db.mock');
const Transaction = require('../../src/models/Transaction');

describe('Transaction Model', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // CREATE TRANSACTION
  // ============================================
  describe('create()', () => {
    it('should create a transaction record', async () => {
      const mockTx = {
        id:           'tx-uuid-123',
        booking_id:   'booking-uuid',
        tx_hash:      'ABC123TXHASH',
        from_address: 'rDriverAddress',
        to_address:   'rAdminAddress',
        amount_xrp:   '10.5',
        tx_type:      'driver_to_admin',
        status:       'validated',
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockTx] });

      const result = await Transaction.create({
        bookingId:   'booking-uuid',
        txHash:      'ABC123TXHASH',
        fromAddress: 'rDriverAddress',
        toAddress:   'rAdminAddress',
        amountXrp:   10.5,
        amountDrops: 10500000,
        txType:      'driver_to_admin',
        status:      'validated',
        ledgerIndex: 12345,
        resultCode:  'tesSUCCESS',
      });

      expect(result).toEqual(mockTx);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining(['booking-uuid', 'ABC123TXHASH', 'driver_to_admin'])
      );
    });
  });

  // ============================================
  // FIND BY BOOKING
  // ============================================
  describe('findByBooking()', () => {
    it('should return all transactions for a booking', async () => {
      const mockTxs = [
        { id: 'tx-1', tx_type: 'driver_to_admin', amount_xrp: '10.0' },
        { id: 'tx-2', tx_type: 'admin_to_seller', amount_xrp: '8.0'  },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockTxs });

      const result = await Transaction.findByBooking('booking-uuid');

      expect(result).toHaveLength(2);
      expect(result[0].tx_type).toBe('driver_to_admin');
      expect(result[1].tx_type).toBe('admin_to_seller');
    });
  });

  // ============================================
  // FIND BY HASH
  // ============================================
  describe('findByHash()', () => {
    it('should return transaction for valid hash', async () => {
      const mockTx = {
        id:      'tx-uuid',
        tx_hash: 'VALID_HASH_123',
        status:  'validated',
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockTx] });

      const result = await Transaction.findByHash('VALID_HASH_123');

      expect(result).toEqual(mockTx);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tx_hash = $1'),
        ['VALID_HASH_123']
      );
    });

    it('should return null for unknown hash', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await Transaction.findByHash('UNKNOWN_HASH');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // FIND ALL (ADMIN)
  // ============================================
  describe('findAll()', () => {
    it('should return paginated transactions', async () => {
      const mockTxs = [
        { id: 'tx-1', tx_type: 'driver_to_admin', amount_xrp: '10.0' },
        { id: 'tx-2', tx_type: 'admin_to_seller', amount_xrp: '8.0'  },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockTxs });

      const result = await Transaction.findAll(10, 0);

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 0]
      );
    });

    it('should use default limit 50 and offset 0', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await Transaction.findAll();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [50, 0]
      );
    });
  });

  // ============================================
  // GET ADMIN EARNINGS
  // ============================================
  describe('getAdminEarnings()', () => {
    it('should return admin earnings summary', async () => {
      const mockEarnings = {
        total_payments:         '10',
        total_received_xrp:     '100.5',
        total_paid_sellers_xrp: '80.4',
        admin_profit_xrp:       '20.1',
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockEarnings] });

      const result = await Transaction.getAdminEarnings();

      expect(result).toEqual(mockEarnings);
      expect(parseFloat(result.admin_profit_xrp)).toBeCloseTo(20.1);
    });
  });

  // ============================================
  // FIND BY SELLER ID
  // ============================================
  describe('findBySellerId()', () => {
    it('should return only admin_to_seller transactions', async () => {
      const mockTxs = [
        {
          id:         'tx-1',
          tx_type:    'admin_to_seller',
          amount_xrp: '8.0',
          spot_title: 'My Spot',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockTxs });

      const result = await Transaction.findBySellerId('seller-uuid');

      expect(result).toHaveLength(1);
      expect(result[0].tx_type).toBe('admin_to_seller');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("tx_type = 'admin_to_seller'"),
        expect.arrayContaining(['seller-uuid'])
      );
    });

    it('should return empty array if no transactions', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await Transaction.findBySellerId('seller-uuid');

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // GET SELLER EARNINGS
  // ============================================
  describe('getSellerEarnings()', () => {
    it('should return total earnings for a seller', async () => {
      const mockEarnings = {
        total_transactions: '5',
        total_earned_xrp:   '40.0',
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockEarnings] });

      const result = await Transaction.getSellerEarnings('seller-uuid');

      expect(result.total_earned_xrp).toBe('40.0');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('admin_to_seller'),
        ['seller-uuid']
      );
    });
  });

  // ============================================
  // GET SELLER EARNINGS SERIES
  // ============================================
  describe('getSellerEarningsSeries()', () => {
    it('should return weekly earnings with 7 labels', async () => {
      const mockRows = Array(7).fill({ total: '5.0' });
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const result = await Transaction.getSellerEarningsSeries(
        'seller-uuid', 'week'
      );

      expect(result.labels).toHaveLength(7);
      expect(result.labels).toEqual(
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      );
      expect(result.values).toHaveLength(7);
      expect(result.values[0]).toBe(5.0);
    });

    it('should return monthly earnings with 4 labels', async () => {
      const mockRows = Array(4).fill({ total: '10.0' });
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const result = await Transaction.getSellerEarningsSeries(
        'seller-uuid', 'month'
      );

      expect(result.labels).toEqual(['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']);
      expect(result.values).toHaveLength(4);
    });

    it('should return yearly earnings with 12 labels', async () => {
      const mockRows = Array(12).fill({ total: '20.0' });
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const result = await Transaction.getSellerEarningsSeries(
        'seller-uuid', 'year'
      );

      expect(result.labels).toHaveLength(12);
      expect(result.labels[0]).toBe('Jan');
      expect(result.labels[11]).toBe('Dec');
    });

    it('should default to year for unknown period', async () => {
      const mockRows = Array(12).fill({ total: '0' });
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const result = await Transaction.getSellerEarningsSeries(
        'seller-uuid', 'invalid'
      );

      expect(result.labels).toHaveLength(12);
    });
  });

}); // ← end describe('Transaction Model')