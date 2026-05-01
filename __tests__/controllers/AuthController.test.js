// __tests__/controllers/AuthController.test.js

jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('../../src/models/User');
jest.mock('../../src/controllers/UserController', () => ({
    buildProfileResponse: jest.fn()
}));

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const { buildProfileResponse } = require('../../src/controllers/UserController');
const AuthController = require('../../src/controllers/AuthController');

const mockReq = (overrides = {}) => ({
    body: {},
    params: {},
    user: {},
    ...overrides,
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('AuthController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        process.env.JWT_EXPIRES_IN = '7d';
        jwt.sign.mockReturnValue('mocked-token');
    });

    // ============================================
    // xamanLogin()
    // ============================================
    describe('xamanLogin()', () => {
        it('should return 400 if wallet_address is missing', async () => {
            const req = mockReq({ body: { role: 'driver' } });
            const res = mockRes();

            await AuthController.xamanLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'wallet_address is required from Xaman.' });
        });

        it('should login existing user successfully', async () => {
            const req = mockReq({ body: { wallet_address: 'rWallet123', role: 'seller' } });
            const res = mockRes();
            
            const existingUser = { 
                id: 'user-1', 
                role: 'seller', 
                wallet_address: 'rWallet123',
                email: null,
                name: null
            };
            User.findByWalletAddress.mockResolvedValue(existingUser);

            await AuthController.xamanLogin(req, res);

            expect(User.findByWalletAddress).toHaveBeenCalledWith('rWallet123');
            expect(User.createXamanUser).not.toHaveBeenCalled();
            expect(jwt.sign).toHaveBeenCalledWith(
                { userId: 'user-1', role: 'seller' },
                'test-secret',
                { expiresIn: '7d' }
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Xaman authentication successful',
                token: 'mocked-token',
                user: expect.objectContaining({ id: 'user-1', wallet_address: 'rWallet123' })
            }));
        });

        it('should register and login new user successfully', async () => {
            const req = mockReq({ body: { wallet_address: 'rWallet456', role: 'driver' } });
            const res = mockRes();
            
            User.findByWalletAddress.mockResolvedValue(null);
            const newUser = { id: 'user-2', role: 'driver', wallet_address: 'rWallet456' };
            User.createXamanUser.mockResolvedValue(newUser);

            await AuthController.xamanLogin(req, res);

            expect(User.findByWalletAddress).toHaveBeenCalledWith('rWallet456');
            expect(User.createXamanUser).toHaveBeenCalledWith({
                walletAddress: 'rWallet456',
                role: 'driver'
            });
            expect(jwt.sign).toHaveBeenCalledWith(
                { userId: 'user-2', role: 'driver' },
                'test-secret',
                { expiresIn: '7d' }
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                token: 'mocked-token',
                user: expect.objectContaining({ id: 'user-2' })
            }));
        });

        it('should default to driver role if role is omitted or invalid for new user', async () => {
            const req = mockReq({ body: { wallet_address: 'rWallet789', role: 'invalid' } });
            const res = mockRes();
            
            User.findByWalletAddress.mockResolvedValue(null);
            User.createXamanUser.mockResolvedValue({ id: 'user-3', role: 'driver' });

            await AuthController.xamanLogin(req, res);

            expect(User.createXamanUser).toHaveBeenCalledWith(expect.objectContaining({
                role: 'driver'
            }));
        });

        it('should return 500 on database error', async () => {
            const req = mockReq({ body: { wallet_address: 'rWallet123' } });
            const res = mockRes();
            
            User.findByWalletAddress.mockRejectedValue(new Error('DB Error'));

            await AuthController.xamanLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Registration failed. Please try again.' });
        });
    });

    // ============================================
    // adminLogin()
    // ============================================
    describe('adminLogin()', () => {
        it('should return 400 if email or password missing', async () => {
            const req = mockReq({ body: { email: 'admin@example.com' } });
            const res = mockRes();

            await AuthController.adminLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Email and password are required.' });
        });

        it('should return 401 if admin not found', async () => {
            const req = mockReq({ body: { email: 'admin@example.com', password: 'password123' } });
            const res = mockRes();
            
            User.findAdminByEmail.mockResolvedValue(null);

            await AuthController.adminLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email or password.' });
        });

        it('should return 401 if admin account not configured (no password)', async () => {
            const req = mockReq({ body: { email: 'admin@example.com', password: 'password123' } });
            const res = mockRes();
            
            User.findAdminByEmail.mockResolvedValue({ email: 'admin@example.com' /* no password */ });

            await AuthController.adminLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Admin account not properly configured.' });
        });

        it('should return 401 if password is invalid', async () => {
            const req = mockReq({ body: { email: 'admin@example.com', password: 'wrongpassword' } });
            const res = mockRes();
            
            User.findAdminByEmail.mockResolvedValue({ 
                email: 'admin@example.com', 
                password: 'hashed-password' 
            });
            bcrypt.compare.mockResolvedValue(false);

            await AuthController.adminLogin(req, res);

            expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashed-password');
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email or password.' });
        });

        it('should login successfully with correct credentials', async () => {
            const req = mockReq({ body: { email: 'admin@example.com', password: 'correctpassword' } });
            const res = mockRes();
            
            const mockAdmin = { 
                id: 'admin-1', 
                email: 'admin@example.com', 
                password: 'hashed-password',
                role: 'admin',
                name: 'Admin User'
            };
            
            User.findAdminByEmail.mockResolvedValue(mockAdmin);
            bcrypt.compare.mockResolvedValue(true);

            await AuthController.adminLogin(req, res);

            expect(jwt.sign).toHaveBeenCalledWith(
                { userId: 'admin-1', role: 'admin' },
                'test-secret',
                { expiresIn: '7d' }
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Admin login successful',
                token: 'mocked-token',
                user: expect.objectContaining({ id: 'admin-1', email: 'admin@example.com' })
            }));
        });

        it('should return 500 on error', async () => {
            const req = mockReq({ body: { email: 'admin@example.com', password: 'password123' } });
            const res = mockRes();
            
            User.findAdminByEmail.mockRejectedValue(new Error('DB Error'));

            await AuthController.adminLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Login failed. Please try again.' });
        });
    });

    // ============================================
    // changePassword()
    // ============================================
    describe('changePassword()', () => {
        it('should return 400 if fields are missing', async () => {
            const req = mockReq({ user: { id: 'admin-1' }, body: { newPassword: 'Pass!123Word' } });
            const res = mockRes();

            await AuthController.changePassword(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Current password and new password are required.' });
        });

        it('should return 401 if admin account not configured or missing', async () => {
            const req = mockReq({ 
                user: { id: 'admin-1' }, 
                body: { oldPassword: 'old', newPassword: 'new' } 
            });
            const res = mockRes();

            User.findAdminByIdWithPassword.mockResolvedValue(null);

            await AuthController.changePassword(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Administrator account not properly configured or not found.' });
        });

        it('should return 401 for incorrect current password', async () => {
            const req = mockReq({ 
                user: { id: 'admin-1' }, 
                body: { oldPassword: 'wrongold', newPassword: 'new' } 
            });
            const res = mockRes();

            User.findAdminByIdWithPassword.mockResolvedValue({ id: 'admin-1', password: 'hashed-old' });
            bcrypt.compare.mockResolvedValue(false);

            await AuthController.changePassword(req, res);

            expect(bcrypt.compare).toHaveBeenCalledWith('wrongold', 'hashed-old');
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid current password.' });
        });

        it('should return 400 if new password matches old password', async () => {
            const req = mockReq({ 
                user: { id: 'admin-1' }, 
                body: { oldPassword: 'SamePassword1!', newPassword: 'SamePassword1!' } 
            });
            const res = mockRes();

            User.findAdminByIdWithPassword.mockResolvedValue({ id: 'admin-1', password: 'hashed-old' });
            bcrypt.compare.mockResolvedValue(true); // Old password matches hash

            await AuthController.changePassword(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'New password cannot be the same as the current password.' });
        });

        it('should return 400 if new password does not meet complexity requirements', async () => {
            const req = mockReq({ 
                user: { id: 'admin-1' }, 
                body: { oldPassword: 'OldPassword1!', newPassword: 'weakpassword' } 
            });
            const res = mockRes();

            User.findAdminByIdWithPassword.mockResolvedValue({ id: 'admin-1', password: 'hashed-old' });
            bcrypt.compare.mockResolvedValue(true);

            await AuthController.changePassword(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ 
                error: expect.stringContaining('Password does not meet complexity requirements') 
            });
        });

        it('should update password successfully with valid inputs', async () => {
            const req = mockReq({ 
                user: { id: 'admin-1' }, 
                body: { oldPassword: 'OldPassword1!', newPassword: 'StrongNewPassword123!' } 
            });
            const res = mockRes();

            User.findAdminByIdWithPassword.mockResolvedValue({ id: 'admin-1', password: 'hashed-old' });
            bcrypt.compare.mockResolvedValue(true);
            bcrypt.genSalt.mockResolvedValue('mock-salt');
            bcrypt.hash.mockResolvedValue('hashed-new');
            User.updatePassword.mockResolvedValue(true);

            await AuthController.changePassword(req, res);

            expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
            expect(bcrypt.hash).toHaveBeenCalledWith('StrongNewPassword123!', 'mock-salt');
            expect(User.updatePassword).toHaveBeenCalledWith('admin-1', 'hashed-new');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Password successfully updated.' });
        });

        it('should return 500 on unexpected error', async () => {
            const req = mockReq({ 
                user: { id: 'admin-1' }, 
                body: { oldPassword: 'OldPassword1!', newPassword: 'StrongNewPassword123!' } 
            });
            const res = mockRes();

            User.findAdminByIdWithPassword.mockRejectedValue(new Error('DB Error'));

            await AuthController.changePassword(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred while changing the password.' });
        });
    });

    // ============================================
    // getMe()
    // ============================================
    describe('getMe()', () => {
        it('should return 404 if user not found', async () => {
            const req = mockReq({ user: { id: 'user-1' } });
            const res = mockRes();

            User.findById.mockResolvedValue(null);

            await AuthController.getMe(req, res);

            expect(User.findById).toHaveBeenCalledWith('user-1');
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
        });

        it('should return mapped user profile successfully', async () => {
            const req = mockReq({ user: { id: 'user-1' } });
            const res = mockRes();
            
            const mockUser = { id: 'user-1', name: 'Test User' };
            User.findById.mockResolvedValue(mockUser);
            
            buildProfileResponse.mockReturnValue({
                data: {
                    userId: 'user-1',
                    fullName: 'Test User'
                }
            });

            await AuthController.getMe(req, res);

            expect(buildProfileResponse).toHaveBeenCalledWith(mockUser);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                data: {
                    userId: 'user-1',
                    fullName: 'Test User'
                }
            });
        });

        it('should return 500 on database error', async () => {
            const req = mockReq({ user: { id: 'user-1' } });
            const res = mockRes();
            
            User.findById.mockRejectedValue(new Error('DB Error'));

            await AuthController.getMe(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get user info.' });
        });
    });
});