import crypto from 'crypto';
import { db } from '../lib/db.js';

export const getChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT c.id, c.type, c.name, c.user1_id as "user1Id", c.user2_id as "user2Id", c.created_at as "createdAt",
              u1.id as u1_id, u1.email as u1_email, u1.name as u1_name,
              u2.id as u2_id, u2.email as u2_email, u2.name as u2_name
       FROM chats c
       JOIN chat_members cm ON c.id = cm.chat_id AND cm.user_id = $1
       LEFT JOIN users u1 ON c.user1_id = u1.id
       LEFT JOIN users u2 ON c.user2_id = u2.id
       ORDER BY c.created_at DESC`,
      [userId]
    );

    const chats = await Promise.all(
      result.rows.map(async (chat) => {
        const lastMsgResult = await db.query(
          `SELECT m.id, m.content, m.status, m.sender_id as "senderId", m.created_at as "createdAt"
           FROM messages m
           WHERE m.chat_id = $1
           ORDER BY m.created_at DESC
           LIMIT 1`,
          [chat.id]
        );
        const lastMessage = lastMsgResult.rows[0]
          ? {
              id: lastMsgResult.rows[0].id,
              content: lastMsgResult.rows[0].content,
              status: lastMsgResult.rows[0].status,
              senderId: lastMsgResult.rows[0].senderId,
              createdAt: lastMsgResult.rows[0].createdAt,
            }
          : null;

        if (chat.type === 'group') {
          const membersResult = await db.query(
            `SELECT u.id, u.name, u.email
             FROM chat_members cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.chat_id = $1`,
            [chat.id]
          );
          const members = membersResult.rows.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
          }));
          return {
            id: chat.id,
            type: 'group',
            name: chat.name,
            members,
            lastMessage,
            createdAt: chat.createdAt,
          };
        }

        const other =
          chat.user1Id === userId
            ? { id: chat.u2_id, email: chat.u2_email, name: chat.u2_name }
            : { id: chat.u1_id, email: chat.u1_email, name: chat.u1_name };
        return {
          id: chat.id,
          type: 'direct',
          otherUser: other,
          lastMessage,
          createdAt: chat.createdAt,
        };
      })
    );

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to get chats.' });
  }
};

export const getChatById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: chatId } = req.params;
    const result = await db.query(
      `SELECT c.id, c.type, c.name, c.user1_id as "user1Id", c.user2_id as "user2Id", c.created_at as "createdAt",
              u1.id as u1_id, u1.email as u1_email, u1.name as u1_name,
              u2.id as u2_id, u2.email as u2_email, u2.name as u2_name
       FROM chats c
       LEFT JOIN users u1 ON c.user1_id = u1.id
       LEFT JOIN users u2 ON c.user2_id = u2.id
       WHERE c.id = $1
         AND (c.user1_id = $2 OR c.user2_id = $2 OR EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = c.id AND cm.user_id = $2))`,
      [chatId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Chat not found.' });
    }
    const chat = result.rows[0];

    if (chat.type === 'group') {
      const membersResult = await db.query(
        `SELECT u.id, u.name, u.email
         FROM chat_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chat_id = $1`,
        [chatId]
      );
      return res.json({
        id: chat.id,
        type: 'group',
        name: chat.name,
        members: membersResult.rows.map((r) => ({ id: r.id, name: r.name, email: r.email })),
        createdAt: chat.createdAt,
      });
    }

    const other =
      chat.user1Id === userId
        ? { id: chat.u2_id, email: chat.u2_email, name: chat.u2_name }
        : { id: chat.u1_id, email: chat.u1_email, name: chat.u1_name };
    return res.json({
      id: chat.id,
      type: 'direct',
      otherUser: other,
      createdAt: chat.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to get chat.' });
  }
};

export const createChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userId: otherUserId, name, memberIds } = req.body;

    // Debug logging
    console.log('createChat request body:', JSON.stringify(req.body, null, 2));
    console.log('Parsed values:', { 
      otherUserId, 
      name, 
      nameType: typeof name,
      memberIds, 
      memberIdsType: typeof memberIds,
      memberIdsIsArray: Array.isArray(memberIds),
      memberIdsLength: memberIds?.length 
    });

    // Check for group creation first (if name and memberIds are provided)
    // Explicitly check that name is a non-empty string and memberIds is an array
    const isGroupRequest = name && typeof name === 'string' && name.trim().length > 0 && Array.isArray(memberIds) && memberIds.length > 0;
    
    if (isGroupRequest) {
      console.log('Processing group creation...');
      if (memberIds.length < 2) {
        return res.status(400).json({
          message: 'Group chat requires at least 2 members.',
        });
      }
      const uniqueIds = [...new Set(memberIds)];
      if (!uniqueIds.includes(userId)) {
        return res.status(400).json({ message: 'You must include yourself in memberIds.' });
      }
      const chatId = crypto.randomUUID();
      await db.query(
        `INSERT INTO chats (id, type, name, user1_id, user2_id, created_at) VALUES ($1, 'group', $2, NULL, NULL, NOW())`,
        [chatId, name]
      );
      for (const memberId of uniqueIds) {
        await db.query(
          `INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT (chat_id, user_id) DO NOTHING`,
          [chatId, memberId]
        );
      }
      const membersResult = await db.query(
        `SELECT u.id, u.name, u.email
         FROM chat_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chat_id = $1`,
        [chatId]
      );
      const members = membersResult.rows.map((r) => ({ id: r.id, name: r.name, email: r.email }));
      const createdResult = await db.query('SELECT created_at as "createdAt" FROM chats WHERE id = $1', [chatId]);
      const createdAt = createdResult.rows[0]?.createdAt ?? new Date().toISOString();
      return res.status(201).json({
        id: chatId,
        type: 'group',
        name,
        members,
        createdAt,
      });
    }

    // Otherwise, handle direct chat creation
    if (otherUserId != null) {
      if (otherUserId === userId) {
        return res.status(400).json({ message: 'Cannot chat with yourself.' });
      }
      const u1 = userId < otherUserId ? userId : otherUserId;
      const u2 = userId < otherUserId ? otherUserId : userId;

      let chatResult = await db.query(
        `SELECT c.id, c.user1_id as "user1Id", c.user2_id as "user2Id", c.created_at as "createdAt",
                u1.id as u1_id, u1.email as u1_email, u1.name as u1_name,
                u2.id as u2_id, u2.email as u2_email, u2.name as u2_name
         FROM chats c
         JOIN users u1 ON c.user1_id = u1.id
         JOIN users u2 ON c.user2_id = u2.id
         WHERE c.user1_id = $1 AND c.user2_id = $2 AND c.type = 'direct'`,
        [u1, u2]
      );

      if (chatResult.rows.length === 0) {
        const chatId = crypto.randomUUID();
        await db.query(
          `INSERT INTO chats (id, type, name, user1_id, user2_id, created_at) VALUES ($1, 'direct', NULL, $2, $3, NOW())`,
          [chatId, u1, u2]
        );
        await db.query(
          `INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
          [chatId, u1, u2]
        );
        chatResult = await db.query(
          `SELECT c.id, c.user1_id as "user1Id", c.user2_id as "user2Id", c.created_at as "createdAt",
                  u1.id as u1_id, u1.email as u1_email, u1.name as u1_name,
                  u2.id as u2_id, u2.email as u2_email, u2.name as u2_name
           FROM chats c
           JOIN users u1 ON c.user1_id = u1.id
           JOIN users u2 ON c.user2_id = u2.id
           WHERE c.id = $1`,
          [chatId]
        );
      }

      const chat = chatResult.rows[0];
      const other =
        chat.user1Id === userId
          ? { id: chat.u2_id, email: chat.u2_email, name: chat.u2_name }
          : { id: chat.u1_id, email: chat.u1_email, name: chat.u1_name };
      return res.status(201).json({
        id: chat.id,
        type: 'direct',
        otherUser: other,
        createdAt: chat.createdAt,
      });
    }

    // If neither group nor direct chat conditions are met
    console.log('No valid chat creation parameters provided');
    console.log('Request body keys:', Object.keys(req.body));
    return res.status(400).json({
      message: 'Either provide userId for direct chat or name and memberIds for group chat.',
      received: { hasUserId: otherUserId != null, hasName: !!name, hasMemberIds: Array.isArray(memberIds), memberIdsLength: memberIds?.length }
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to create chat.' });
  }
};
