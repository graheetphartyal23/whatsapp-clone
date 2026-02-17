import { prisma } from '../lib/prisma.js';

export const getChatMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: chatId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const cursor = req.query.cursor || undefined;

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
    });
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found.' });
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });

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

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
    });
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found.' });
    }

    const message = await prisma.message.create({
      data: { chatId, senderId: userId, content, status: 'sent' },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });

    const recipientId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
    if (req.io) {
      req.io.to(recipientId).emit('receive_message', message);
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

    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: { chat: true },
    });
    if (!message) return res.status(404).json({ message: 'Message not found.' });
    if (message.chat.user1Id !== userId && message.chat.user2Id !== userId) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (message.senderId === userId) return res.status(400).json({ message: 'Sender cannot mark own message.' });

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { status },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to update status.' });
  }
};
