import { prisma } from '../lib/prisma.js';

export const getChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await prisma.chat.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: { select: { id: true, email: true, name: true } },
        user2: { select: { id: true, email: true, name: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = chats.map((chat) => {
      const other = chat.user1Id === userId ? chat.user2 : chat.user1;
      const lastMessage = chat.messages[0] || null;
      return {
        id: chat.id,
        otherUser: other,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              status: lastMessage.status,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
            }
          : null,
        createdAt: chat.createdAt,
      };
    });
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to get chats.' });
  }
};

export const getChatById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: chatId } = req.params;
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: { select: { id: true, email: true, name: true } },
        user2: { select: { id: true, email: true, name: true } },
      },
    });
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found.' });
    }
    const other = chat.user1Id === userId ? chat.user2 : chat.user1;
    res.json({ id: chat.id, otherUser: other, createdAt: chat.createdAt });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to get chat.' });
  }
};

export const createChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userId: otherUserId } = req.body;
    if (!otherUserId) {
      return res.status(400).json({ message: 'userId (other user) is required.' });
    }
    if (otherUserId === userId) {
      return res.status(400).json({ message: 'Cannot chat with yourself.' });
    }

    const u1 = userId < otherUserId ? userId : otherUserId;
    const u2 = userId < otherUserId ? otherUserId : userId;

    let chat = await prisma.chat.findFirst({
      where: { user1Id: u1, user2Id: u2 },
      include: {
        user1: { select: { id: true, email: true, name: true } },
        user2: { select: { id: true, email: true, name: true } },
      },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: { user1Id: u1, user2Id: u2 },
        include: {
          user1: { select: { id: true, email: true, name: true } },
          user2: { select: { id: true, email: true, name: true } },
        },
      });
    }

    const other = chat.user1Id === userId ? chat.user2 : chat.user1;
    res.status(201).json({
      id: chat.id,
      otherUser: other,
      createdAt: chat.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to create chat.' });
  }
};
