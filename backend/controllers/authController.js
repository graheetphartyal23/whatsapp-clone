import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-clone-secret-change-in-production';

const generateToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });

function toUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at || user.createdAt,
  };
}

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }
    const existingResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const result = await db.query(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, email, name, created_at',
      [id, email, passwordHash, name || null]
    );
    const user = result.rows[0];
    const token = generateToken(user.id);
    res.status(201).json({ ...toUserResponse(user), token });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Registration failed.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }
    const result = await db.query('SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const token = generateToken(user.id);
    res.json({ ...toUserResponse(user), token });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Login failed.' });
  }
};

export const getMe = async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to get user.' });
  }
};

export const getUsers = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, created_at as "createdAt" FROM users WHERE id != $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to get users.' });
  }
};
