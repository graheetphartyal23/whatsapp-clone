import express from 'express';
import { getChats, getChatById, createChat } from '../controllers/chatController.js';
import { getChatMessages } from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.get('/', getChats);
router.get('/:id/messages', getChatMessages);
router.get('/:id', getChatById);
router.post('/', createChat);

export default router;
