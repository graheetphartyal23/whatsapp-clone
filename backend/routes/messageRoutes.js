import express from 'express';
import {
  getChatMessages,
  createMessage,
  updateMessageStatus,
  deleteMessage,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/', createMessage);
router.patch('/:messageId/status', updateMessageStatus);
router.delete('/:messageId', deleteMessage);

export default router;
