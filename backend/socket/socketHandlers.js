import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../lib/db.js';

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

        const chatResult = await db.query(
          `SELECT c.type, c.user1_id as "user1Id", c.user2_id as "user2Id"
           FROM chats c
           WHERE c.id = $1
             AND (c.user1_id = $2 OR c.user2_id = $2 OR EXISTS (
               SELECT 1 FROM chat_members cm WHERE cm.chat_id = c.id AND cm.user_id = $2
             ))`,
          [chatId, socket.userId]
        );
        if (chatResult.rows.length === 0) {
          socket.emit('message_error', { message: 'Chat not found.' });
          return;
        }

        const chat = chatResult.rows[0];
        const messageId = crypto.randomUUID();
        const result = await db.query(
          'INSERT INTO messages (id, chat_id, sender_id, content, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING created_at',
          [messageId, chatId, socket.userId, content, 'sent']
        );
        const createdAt = result.rows[0].created_at;

        const senderResult = await db.query('SELECT id, name, email FROM users WHERE id = $1', [socket.userId]);
        const sender = senderResult.rows[0];

        const message = {
          id: messageId,
          chatId,
          senderId: socket.userId,
          content,
          status: 'sent',
          createdAt: createdAt,
          sender: {
            id: sender.id,
            name: sender.name,
            email: sender.email,
          },
        };

        if (chat.type === 'group') {
          const membersResult = await db.query(
            'SELECT user_id FROM chat_members WHERE chat_id = $1',
            [chatId]
          );
          for (const row of membersResult.rows) {
            io.to(row.user_id).emit('receive_message', message);
          }
        } else {
          const recipientId = chat.user1Id === socket.userId ? chat.user2Id : chat.user1Id;
          io.to(recipientId).emit('receive_message', message);
          socket.emit('receive_message', message);
        }
      } catch (err) {
        socket.emit('message_error', { message: err.message });
      }
    });

    socket.on('message_status_update', async (payload) => {
      try {
        const { messageId, status } = payload;
        if (!messageId || !['delivered', 'read'].includes(status)) return;

        const messageResult = await db.query(
          `SELECT m.id, m.sender_id as "senderId", c.user1_id as "user1Id", c.user2_id as "user2Id",
                  (EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = c.id AND cm.user_id = $2)) AS "isGroupMember"
           FROM messages m
           JOIN chats c ON m.chat_id = c.id
           WHERE m.id = $1`,
          [messageId, socket.userId]
        );
        if (messageResult.rows.length === 0) return;

        const message = messageResult.rows[0];
        if (message.senderId === socket.userId) return;
        const isInChat =
          message.user1Id === socket.userId ||
          message.user2Id === socket.userId ||
          message.isGroupMember === true;
        if (!isInChat) return;

        await db.query('UPDATE messages SET status = $1 WHERE id = $2', [status, messageId]);
        io.to(message.senderId).emit('message_status_update', { messageId, status });
      } catch (err) {
        socket.emit('message_error', { message: err.message });
      }
    });
        // ---------- 1-to-1 call signaling ----------
    socket.on('call_request', (payload) => {
      try {
        const { toUserId, callType, chatId } = payload;
        if (!toUserId || !callType) {
          socket.emit('call_error', { message: 'toUserId and callType are required.' });
          return;
        }
        if (!['audio', 'video'].includes(callType)) {
          socket.emit('call_error', { message: 'callType must be audio or video.' });
          return;
        }
        if (toUserId === socket.userId) {
          socket.emit('call_error', { message: 'Cannot call yourself.' });
          return;
        }
        const fromUserId = socket.userId;
        io.to(toUserId).emit('incoming_call', {
          fromUserId,
          callType,
          chatId: chatId || null,
        });
      } catch (err) {
        socket.emit('call_error', { message: err.message });
      }
    });

    socket.on('call_accept', (payload) => {
      try {
        const { fromUserId, toUserId } = payload;
        if (!fromUserId || !toUserId) {
          socket.emit('call_error', { message: 'fromUserId and toUserId are required.' });
          return;
        }
        if (toUserId !== socket.userId) {
          socket.emit('call_error', { message: 'You can only accept calls intended for you.' });
          return;
        }
        io.to(fromUserId).emit('call_accepted', { byUserId: toUserId });
      } catch (err) {
        socket.emit('call_error', { message: err.message });
      }
    });

    socket.on('call_reject', (payload) => {
      try {
        const { fromUserId, toUserId } = payload;
        if (!fromUserId || !toUserId) {
          socket.emit('call_error', { message: 'fromUserId and toUserId are required.' });
          return;
        }
        if (toUserId !== socket.userId) {
          socket.emit('call_error', { message: 'Invalid reject.' });
          return;
        }
        io.to(fromUserId).emit('call_rejected', { byUserId: toUserId });
      } catch (err) {
        socket.emit('call_error', { message: err.message });
      }
    });

    socket.on('call_end', (payload) => {
      try {
        const { toUserId } = payload;
        if (!toUserId) {
          socket.emit('call_error', { message: 'toUserId is required.' });
          return;
        }
        const fromUserId = socket.userId;
        io.to(toUserId).emit('call_ended', { byUserId: fromUserId });
      } catch (err) {
        socket.emit('call_error', { message: err.message });
      }
    });

    socket.on('webrtc_signal', (payload) => {
      try {
        const { toUserId, signal } = payload;
        if (!toUserId || !signal) {
          socket.emit('call_error', { message: 'toUserId and signal are required.' });
          return;
        }
        const fromUserId = socket.userId;
        io.to(toUserId).emit('webrtc_signal', { fromUserId, signal });
      } catch (err) {
        socket.emit('call_error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      socket.broadcast.emit('user_offline', { userId: socket.userId });
    });
  });
}
