import express from 'express';
import {
  getChatMessages,
  createMessage,
  updateMessageStatus,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/', createMessage);
router.patch('/:messageId/status', updateMessageStatus);

export default router;
