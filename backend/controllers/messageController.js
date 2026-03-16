import crypto from 'crypto';
import { db } from '../lib/db.js';

export const getChatMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: chatId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const cursor = req.query.cursor || undefined;

    const chatResult = await db.query(
      `SELECT id FROM chats c
       WHERE c.id = $1
         AND (c.user1_id = $2 OR c.user2_id = $2 OR EXISTS (
           SELECT 1 FROM chat_members cm WHERE cm.chat_id = c.id AND cm.user_id = $2
         ))`,
      [chatId, userId]
    );
    if (chatResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chat not found.' });
    }

    let query = `
      SELECT m.id, m.chat_id as "chatId", m.sender_id as "senderId", m.content, m.status, m.created_at as "createdAt",
             u.id as sender_id, u.name as sender_name, u.email as sender_email
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = $1
    `;
    const params = [chatId];

    if (cursor) {
      query += ` AND m.id < $2 ORDER BY m.created_at DESC LIMIT $3`;
      params.push(cursor, limit + 1);
    } else {
      query += ` ORDER BY m.created_at DESC LIMIT $2`;
      params.push(limit + 1);
    }

    const result = await db.query(query, params);
    const messages = result.rows.map((row) => ({
      id: row.id,
      chatId: row.chatId,
      senderId: row.senderId,
      content: row.content,
      status: row.status,
      createdAt: row.createdAt,
      sender: {
        id: row.sender_id,
        name: row.sender_name,
        email: row.sender_email,
      },
    }));

    const hasMore = messages.length > limit;
    const list = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? list[list.length - 1].id : null;

    res.json({
      messages: list.reverse(),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to get messages.' });
  }
};

export const createMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId, content } = req.body;
    if (!chatId || content == null || content === '') {
      return res.status(400).json({ message: 'chatId and content are required.' });
    }

    const chatResult = await db.query(
      `SELECT c.type, c.user1_id as "user1Id", c.user2_id as "user2Id"
       FROM chats c
       WHERE c.id = $1
         AND (c.user1_id = $2 OR c.user2_id = $2 OR EXISTS (
           SELECT 1 FROM chat_members cm WHERE cm.chat_id = c.id AND cm.user_id = $2
         ))`,
      [chatId, userId]
    );
    if (chatResult.rows.length === 0) {
      return res.status(404).json({ message: 'Chat not found.' });
    }

    const chat = chatResult.rows[0];
    const messageId = crypto.randomUUID();
    const result = await db.query(
      'INSERT INTO messages (id, chat_id, sender_id, content, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING created_at',
      [messageId, chatId, userId, content, 'sent']
    );
    const createdAt = result.rows[0].created_at;

    const senderResult = await db.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [userId]
    );
    const sender = senderResult.rows[0];

    const message = {
      id: messageId,
      chatId,
      senderId: userId,
      content,
      status: 'sent',
      createdAt: createdAt,
      sender: {
        id: sender.id,
        name: sender.name,
        email: sender.email,
      },
    };

    if (req.io) {
      if (chat.type === 'group') {
        const membersResult = await db.query(
          'SELECT user_id FROM chat_members WHERE chat_id = $1 AND user_id != $2',
          [chatId, userId]
        );
        for (const row of membersResult.rows) {
          req.io.to(row.user_id).emit('receive_message', message);
        }
      } else {
        const recipientId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
        req.io.to(recipientId).emit('receive_message', message);
      }
    }
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to send message.' });
  }
};

export const updateMessageStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { status } = req.body;
    if (!['delivered', 'read'].includes(status)) {
      return res.status(400).json({ message: 'status must be delivered or read.' });
    }

    const messageResult = await db.query(
      `SELECT m.id, m.sender_id as "senderId", c.user1_id as "user1Id", c.user2_id as "user2Id",
              (EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = c.id AND cm.user_id = $2)) AS "isGroupMember"
       FROM messages m
       JOIN chats c ON m.chat_id = c.id
       WHERE m.id = $1`,
      [messageId, userId]
    );
    if (messageResult.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    const message = messageResult.rows[0];
    const isInChat =
      message.user1Id === userId ||
      message.user2Id === userId ||
      message.isGroupMember === true;
    if (!isInChat) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (message.senderId === userId) {
      return res.status(400).json({ message: 'Sender cannot mark own message.' });
    }

    await db.query('UPDATE messages SET status = $1 WHERE id = $2', [status, messageId]);
    const updatedResult = await db.query('SELECT * FROM messages WHERE id = $1', [messageId]);
    res.json(updatedResult.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to update status.' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    if (!messageId) {
      return res.status(400).json({ message: 'messageId is required.' });
    }

    const result = await db.query(
      `SELECT m.id,
              m.chat_id as "chatId",
              m.sender_id as "senderId",
              c.type,
              c.user1_id as "user1Id",
              c.user2_id as "user2Id"
       FROM messages m
       JOIN chats c ON m.chat_id = c.id
       WHERE m.id = $1`,
      [messageId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    const message = result.rows[0];
    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }

    await db.query('DELETE FROM messages WHERE id = $1', [messageId]);

    if (req.io) {
      const payload = { messageId, chatId: message.chatId };

      if (message.type === 'group') {
        const membersResult = await db.query(
          'SELECT user_id FROM chat_members WHERE chat_id = $1',
          [message.chatId]
        );
        for (const row of membersResult.rows) {
          req.io.to(row.user_id).emit('message_deleted', payload);
        }
      } else {
        const otherUserId =
          message.user1Id === userId ? message.user2Id : message.user1Id;
        if (otherUserId) {
          req.io.to(otherUserId).emit('message_deleted', payload);
        }
      }

      // Also notify the sender (current user) so all clients stay in sync
      req.io.to(userId).emit('message_deleted', payload);
    }

    return res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to delete message.' });
  }
};
