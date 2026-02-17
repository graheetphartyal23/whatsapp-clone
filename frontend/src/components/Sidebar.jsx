import { useState } from 'react';
import axios from 'axios';
import './Sidebar.css';

const API = import.meta.env.VITE_API_URL || '';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Sidebar({
  user,
  chats,
  users,
  loadingChats,
  selectedChat,
  onSelectChat,
  onChatsUpdate,
  onLogout,
}) {
  const [showNewChat, setShowNewChat] = useState(false);
  const [search, setSearch] = useState('');

  const startChat = (otherUser) => {
    axios
      .post(
        `${API}/api/chats`,
        { userId: otherUser.id },
        { headers: getAuthHeader() }
      )
      .then((res) => {
        const chat = res.data;
        onChatsUpdate();
        onSelectChat({
          id: chat.id,
          otherUser: chat.otherUser || otherUser,
          lastMessage: null,
          createdAt: chat.createdAt,
        });
        setSearch('');
      })
      .catch(console.error);
  };

  const filteredUsers = users.filter(
    (u) =>
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            <span>{user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}</span>
          </div>
          <span className="sidebar-name">{user?.name || user?.email}</span>
        </div>
        <button type="button" className="sidebar-logout" onClick={onLogout} title="Logout">
          Logout
        </button>
      </header>
      {!showNewChat ? (
        <>
          <div className="sidebar-search">
            <input
              type="text"
              placeholder="Search or start new chat"
              onFocus={() => setShowNewChat(true)}
              readOnly
            />
          </div>
          <div className="chat-list">
            {loadingChats ? (
              <p className="chat-list-loading">Loading chats...</p>
            ) : (
              chats.map((chat) => {
                const other = chat.otherUser;
                const isSelected = selectedChat?.id === chat.id;
                return (
                  <button
                    type="button"
                    key={chat.id}
                    className={`chat-list-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelectChat(chat)}
                  >
                    <div className="chat-list-avatar">
                      <span>{other?.name?.charAt(0)?.toUpperCase() || other?.email?.charAt(0)?.toUpperCase() || '?'}</span>
                      {other?.isOnline && <span className="chat-online-dot" />}
                    </div>
                    <div className="chat-list-info">
                      <span className="chat-list-name">{other?.name || other?.email}</span>
                      <span className="chat-list-preview">
                        {chat.lastMessage ? chat.lastMessage.content : 'No messages yet'}
                      </span>
                    </div>
                    <span className="chat-list-time">
                      {formatTime(chat.lastMessage?.createdAt || chat.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="new-chat-panel">
          <div className="sidebar-search">
            <input
              type="text"
              placeholder="Search users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button
            type="button"
            className="back-to-chats"
            onClick={() => {
              setShowNewChat(false);
              setSearch('');
            }}
          >
            ← Back to chats
          </button>
          <div className="user-list">
            {filteredUsers.map((u) => (
              <button
                type="button"
                key={u.id}
                className="chat-list-item"
                onClick={() => startChat(u)}
              >
                <div className="chat-list-avatar">
                  <span>{u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || '?'}</span>
                  {u.isOnline && <span className="chat-online-dot" />}
                </div>
                <div className="chat-list-info">
                  <span className="chat-list-name">{u.name || u.email}</span>
                  <span className="chat-list-preview">{u.email}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
