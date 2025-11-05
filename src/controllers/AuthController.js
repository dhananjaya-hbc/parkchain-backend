import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Driver } from '../models/users/Driver.js';

dotenv.config();

const ensureJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not set in environment');
    }
};

export const DriverRegister = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        const existing = await findUserByEmail(email);
        if (existing) return res.status(409).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await Driver.create({ name, email, password: hashedPassword, role });

        // remove sensitive fields before returning
        if (user && user.password) delete user.password;

        res.status(201).json({ message: 'User registered successfully', user });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Registration failed' });
    }
};

export const Driverlogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

        const user = await findUserByEmail(email);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

        ensureJwtSecret();
        const token = jwt.sign(
            { id: user.id ?? user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // return non-sensitive user info along with token
        const safeUser = {
            id: user.id ?? user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        };

        res.json({ token, user: safeUser });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Login failed' });
    }
};
