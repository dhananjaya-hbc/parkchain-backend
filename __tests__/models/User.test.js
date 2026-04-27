// __tests__/models/User.test.js

const { query } = require('../../src/config/db');
const User = require('../../src/models/User');

// Mock the database query function
jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // FIND methods
  // ============================================

  describe('findById()', () => {
    it('should return user by ID if found', async () => {
      const mockUser = { id: 'user-1', name: 'John Doe' };
      query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await User.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(expect.any(String), ['user-1']);
    });

    it('should return null if user is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.findById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findAdminByIdWithPassword()', () => {
    it('should return admin user with password if found', async () => {
      const mockAdmin = { id: 'admin-1', password: 'hash', role: 'admin' };
      query.mockResolvedValueOnce({ rows: [mockAdmin] });

      const result = await User.findAdminByIdWithPassword('admin-1');

      expect(result).toEqual(mockAdmin);
      expect(query).toHaveBeenCalledWith(expect.any(String), ['admin-1', 'admin']);
    });

    it('should return null if admin is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.findAdminByIdWithPassword('unknown');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail()', () => {
    it('should return user by email if found', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com' };
      query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await User.findByEmail('test@test.com');

      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(expect.any(String), ['test@test.com']);
    });

    it('should return null if email is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.findByEmail('unknown@test.com');
      expect(result).toBeNull();
    });
  });

  describe('findByWalletAddress()', () => {
    it('should return user by wallet address if found', async () => {
      const mockUser = { id: 'user-1', wallet_address: 'rWallet123' };
      query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await User.findByWalletAddress('rWallet123');

      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(expect.any(String), ['rWallet123']);
    });

    it('should return null if wallet address not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.findByWalletAddress('unknown');
      expect(result).toBeNull();
    });
  });

  // ============================================
  // CREATE methods
  // ============================================

  describe('createXamanUser()', () => {
    it('should execute INSERT query and return new user', async () => {
      const mockNewUser = { id: 'user-2', wallet_address: 'rWallet456', role: 'driver' };
      query.mockResolvedValueOnce({ rows: [mockNewUser] });

      const result = await User.createXamanUser({ walletAddress: 'rWallet456', role: 'driver' });

      expect(result).toEqual(mockNewUser);
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['rWallet456@xaman.local', 'Xaman User rWallet4', 'driver', 'rWallet456']
      );
    });
  });

  describe('createAdmin()', () => {
    it('should execute INSERT query and return new admin', async () => {
      const mockNewAdmin = { id: 'admin-1', email: 'admin@test.com' };
      query.mockResolvedValueOnce({ rows: [mockNewAdmin] });

      const result = await User.createAdmin({ email: 'admin@test.com', name: 'Admin', hashedPassword: 'hash' });

      expect(result).toEqual(mockNewAdmin);
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['admin@test.com', 'Admin', 'hash']
      );
    });
  });

  // ============================================
  // UPDATE methods
  // ============================================

  describe('updateProfile()', () => {
    it('should execute UPDATE query with provided values and return updated user', async () => {
      const mockUpdatedUser = { id: 'user-1', name: 'Updated Name' };
      query.mockResolvedValueOnce({ rows: [mockUpdatedUser] });

      const updates = { name: 'Updated Name', phone: '123', profileImage: 'img.png', licenseNo: 'L-123', vehicleType: 'Car' };
      const result = await User.updateProfile('user-1', updates);

      expect(result).toEqual(mockUpdatedUser);
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['Updated Name', '123', 'img.png', 'user-1', 'L-123', 'Car']
      );
    });

    it('should fallback to null for undefined fields in the query params', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'user-1' }] });

      // Pass an empty object to trigger the `!== undefined ? val : null` conditions
      await User.updateProfile('user-1', {});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [null, null, null, 'user-1', null, null]
      );
    });

    it('should return null if user to update does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.updateProfile('user-unknown', {});
      expect(result).toBeNull();
    });
  });

  describe('updatePassword()', () => {
    it('should execute UPDATE query for password and return user id', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'admin-1' }] });

      const result = await User.updatePassword('admin-1', 'new-hashed-password');

      expect(result).toEqual({ id: 'admin-1' });
      expect(query).toHaveBeenCalledWith(expect.any(String), ['new-hashed-password', 'admin-1']);
    });

    it('should return null if user to update password does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.updatePassword('unknown', 'hash');
      expect(result).toBeNull();
    });
  });

  // ============================================
  // WALLET methods
  // ============================================

  describe('getWalletAddress()', () => {
    it('should return just the wallet address string', async () => {
      query.mockResolvedValueOnce({ rows: [{ wallet_address: 'rTestWallet999' }] });
      const result = await User.getWalletAddress('user-1');
      expect(result).toBe('rTestWallet999');
    });

    it('should return null if user has no wallet or is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.getWalletAddress('user-unknown');
      expect(result).toBeNull();
    });
  });

  // ============================================
  // ADMIN methods
  // ============================================

  describe('findAll()', () => {
    it('should return all users if no role is provided', async () => {
      const mockUsers = [{ id: 'user-1' }, { id: 'user-2' }];
      query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await User.findAll();

      expect(result).toEqual(mockUsers);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        []
      );
      expect(query.mock.calls[0][0]).not.toContain('WHERE role =');
    });

    it('should return filtered users if role is provided', async () => {
      const mockUsers = [{ id: 'user-1', role: 'seller' }];
      query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await User.findAll('seller');

      expect(result).toEqual(mockUsers);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = $1 ORDER BY created_at DESC'),
        ['seller']
      );
    });
  });

  describe('verifySeller()', () => {
    it('should execute UPDATE query and return verified seller', async () => {
      const mockVerified = { id: 'seller-1', kyc_status: 'APPROVED' };
      query.mockResolvedValueOnce({ rows: [mockVerified] });

      const result = await User.verifySeller('seller-1');

      expect(result).toEqual(mockVerified);
      expect(query).toHaveBeenCalledWith(expect.any(String), ['seller-1']);
    });

    it('should return null if seller is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.verifySeller('unknown');
      expect(result).toBeNull();
    });
  });

  describe('findAdminByEmail()', () => {
    it('should return admin user by email if found', async () => {
      const mockAdmin = { id: 'admin-1', email: 'admin@test.com', role: 'admin' };
      query.mockResolvedValueOnce({ rows: [mockAdmin] });

      const result = await User.findAdminByEmail('admin@test.com');

      expect(result).toEqual(mockAdmin);
      expect(query).toHaveBeenCalledWith(expect.any(String), ['admin@test.com', 'admin']);
    });

    it('should return null if admin email not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.findAdminByEmail('unknown@test.com');
      expect(result).toBeNull();
    });
  });

  describe('adminExists()', () => {
    it('should return true if admin exists', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'admin-1' }] });
      const result = await User.adminExists('admin@test.com');
      expect(result).toBe(true);
    });

    it('should return false if admin does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await User.adminExists('unknown@test.com');
      expect(result).toBe(false);
    });
  });

  // ============================================
  // ERROR HANDLING (Optional but good practice)
  // ============================================
  describe('DB Exception handling', () => {
    it('should bubble up database errors', async () => {
      query.mockRejectedValueOnce(new Error('Database Connection Failed'));
      await expect(User.findById('user-1')).rejects.toThrow('Database Connection Failed');
    });
  });
});