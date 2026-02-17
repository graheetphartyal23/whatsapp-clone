import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-clone-secret-change-in-production';

const getUserIdFromToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id;
  } catch {
    return null;
  }
};

export function setupSocketHandlers(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const userId = getUserIdFromToken(token);
    if (!userId) {
      return next(new Error('Authentication error'));
    }
    socket.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(socket.userId);
    socket.broadcast.emit('user_online', { userId: socket.userId });

    socket.on('send_message', async (payload) => {
      try {
        const { chatId, content } = payload;
        if (!chatId || content == null || content === '') return;

        const chat = await prisma.chat.findFirst({
          where: {
            id: chatId,
            OR: [{ user1Id: socket.userId }, { user2Id: socket.userId }],
          },
        });
        if (!chat) {
          socket.emit('message_error', { message: 'Chat not found.' });
          return;
        }

        const message = await prisma.message.create({
          data: { chatId, senderId: socket.userId, content, status: 'sent' },
          include: { sender: { select: { id: true, name: true, email: true } } },
        });

        const recipientId = chat.user1Id === socket.userId ? chat.user2Id : chat.user1Id;
        io.to(recipientId).emit('receive_message', message);
        socket.emit('receive_message', message);
      } catch (err) {
        socket.emit('message_error', { message: err.message });
      }
    });

    socket.on('message_status_update', async (payload) => {
      try {
        const { messageId, status } = payload;
        if (!messageId || !['delivered', 'read'].includes(status)) return;

        const message = await prisma.message.findFirst({
          where: { id: messageId },
          include: { chat: true },
        });
        if (!message) return;
        if (message.chat.user1Id !== socket.userId && message.chat.user2Id !== socket.userId) return;
        if (message.senderId === socket.userId) return;

        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { status },
        });
        io.to(message.senderId).emit('message_status_update', { messageId, status });
      } catch (err) {
        socket.emit('message_error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      socket.broadcast.emit('user_offline', { userId: socket.userId });
    });
  });
}
