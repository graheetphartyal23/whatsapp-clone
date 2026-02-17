import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import MessageInput from '../components/MessageInput';
import './Chat.css';

const API = import.meta.env.VITE_API_URL || '';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setUserOnline(list, userId, isOnline) {
  return list.map((u) => (u.id === userId ? { ...u, isOnline } : u));
}

function setChatOtherOnline(chats, userId, isOnline) {
  return chats.map((c) =>
    c.otherUser?.id === userId ? { ...c, otherUser: { ...c.otherUser, isOnline } } : c
  );
}

export default function Chat() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchChats = useCallback(() => {
    setLoadingChats(true);
    axios
      .get(`${API}/api/chats`, { headers: getAuthHeader() })
      .then((res) => setChats(res.data))
      .catch(console.error)
      .finally(() => setLoadingChats(false));
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/api/auth/users`, { headers: getAuthHeader() })
      .then((res) => setUsers(res.data))
      .catch(console.error);
    fetchChats();
  }, [fetchChats]);

  const onNewMessage = useCallback((message) => {
    const chatId = message.chatId;
    const isForSelected = selectedChat?.id === chatId;
    if (isForSelected) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    }
    setChats((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((c) => c.id === chatId);
      if (idx >= 0) {
        const updated = {
          ...copy[idx],
          lastMessage: {
            id: message.id,
            content: message.content,
            status: message.status,
            senderId: message.senderId,
            createdAt: message.createdAt,
          },
        };
        return [updated, ...copy.filter((_, i) => i !== idx)];
      }
      return prev;
    });
  }, [selectedChat?.id]);

  const onStatusUpdate = useCallback(({ messageId, status }) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status } : m))
    );
    setChats((prev) =>
      prev.map((c) =>
        c.lastMessage?.id === messageId
          ? { ...c, lastMessage: { ...c.lastMessage, status } }
          : c
      )
    );
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('receive_message', onNewMessage);
    socket.on('message_status_update', onStatusUpdate);
    socket.on('message_error', (err) => console.error('Socket error:', err));
    return () => {
      socket.off('receive_message', onNewMessage);
      socket.off('message_status_update', onStatusUpdate);
      socket.off('message_error');
    };
  }, [socket, onNewMessage, onStatusUpdate]);

  useEffect(() => {
    if (!socket) return;
    const onOnline = ({ userId }) => {
      setUsers((prev) => setUserOnline(prev, userId, true));
      setChats((prev) => setChatOtherOnline(prev, userId, true));
      setSelectedChat((prev) =>
        prev?.otherUser?.id === userId ? { ...prev, otherUser: { ...prev.otherUser, isOnline: true } } : prev
      );
    };
    const onOffline = ({ userId }) => {
      setUsers((prev) => setUserOnline(prev, userId, false));
      setChats((prev) => setChatOtherOnline(prev, userId, false));
      setSelectedChat((prev) =>
        prev?.otherUser?.id === userId ? { ...prev, otherUser: { ...prev.otherUser, isOnline: false } } : prev
      );
    };
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);
    return () => {
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
    };
  }, [socket]);

  useEffect(() => {
    if (!selectedChat?.id) {
      setMessages([]);
      setNextCursor(null);
      return;
    }
    setLoadingMessages(true);
    axios
      .get(`${API}/api/chats/${selectedChat.id}/messages`, {
        headers: getAuthHeader(),
        params: { limit: 50 },
      })
      .then((res) => {
        setMessages(res.data.messages || []);
        setNextCursor(res.data.nextCursor || null);
      })
      .catch(console.error)
      .finally(() => setLoadingMessages(false));
  }, [selectedChat?.id]);

  const loadOlderMessages = useCallback(() => {
    if (!nextCursor || !selectedChat?.id || loadingMore) return;
    setLoadingMore(true);
    axios
      .get(`${API}/api/chats/${selectedChat.id}/messages`, {
        headers: getAuthHeader(),
        params: { limit: 50, cursor: nextCursor },
      })
      .then((res) => {
        const list = res.data.messages || [];
        setMessages((prev) => [...list, ...prev]);
        setNextCursor(res.data.nextCursor || null);
      })
      .catch(console.error)
      .finally(() => setLoadingMore(false));
  }, [selectedChat?.id, nextCursor, loadingMore]);

  return (
    <div className="chat-layout">
      <Sidebar
        user={user}
        chats={chats}
        users={users}
        loadingChats={loadingChats}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        onChatsUpdate={fetchChats}
        onLogout={logout}
      />
      <div className="chat-main">
        {selectedChat ? (
          <>
            <ChatWindow
              otherUser={selectedChat.otherUser}
              messages={messages}
              loading={loadingMessages}
              currentUserId={user?.id}
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              onLoadOlder={loadOlderMessages}
              onNewMessage={onNewMessage}
              onStatusUpdate={onStatusUpdate}
            />
            <MessageInput
              chatId={selectedChat.id}
              onMessageSent={onNewMessage}
            />
          </>
        ) : (
          <div className="chat-placeholder">
            <p>Select a chat or start a new conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
