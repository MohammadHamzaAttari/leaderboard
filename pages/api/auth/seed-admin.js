import { connectToDatabase } from '../../../lib/mongodb';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const { db } = await connectToDatabase();

        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            email,
            password: hashedPassword,
            name: name || 'Admin User',
            role: 'admin',
            createdAt: new Date(),
        };

        const result = await db.collection('users').insertOne(newUser);

        res.status(201).json({ message: 'Admin user created successfully', userId: result.insertedId });
    } catch (error) {
        console.error('Error creating admin user:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
