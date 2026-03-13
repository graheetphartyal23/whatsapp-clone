import express from 'express';
import crypto from 'crypto';
import { db } from '../lib/db.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Simple admin check: first registered user (small demo app assumption)
async function isAdmin(userId) {
  const result = await db.query(
    'SELECT id FROM users ORDER BY created_at ASC LIMIT 1'
  );
  const firstUser = result.rows[0];
  return firstUser && firstUser.id === userId;
}

// GET /api/announcements - public (any logged-in user)
router.get('/', protect, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, message, created_at as "createdAt" FROM announcements ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch announcements.' });
  }
});

// POST /api/announcements - admin only
router.post('/', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const admin = await isAdmin(req.user.id);
    if (!admin) {
      return res.status(403).json({ message: 'Only admins can create announcements.' });
    }

    const id = crypto.randomUUID();
    const result = await db.query(
      'INSERT INTO announcements (id, message, created_at) VALUES ($1, $2, NOW()) RETURNING id, message, created_at as "createdAt"',
      [id, message.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create announcement.' });
  }
});

export default router;

