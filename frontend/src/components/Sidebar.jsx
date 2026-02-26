import { useState } from 'react';
import axios from 'axios';
import './Sidebar.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

function getChatDisplayName(chat) {
  if (chat.type === 'group') {
    return chat.name || 'Group';
  }
  return chat.otherUser?.name || chat.otherUser?.email || 'Unknown';
}

function getChatAvatar(chat) {
  if (chat.type === 'group') {
    return (chat.name || 'Group').charAt(0).toUpperCase();
  }
  return chat.otherUser?.name?.charAt(0)?.toUpperCase() || 
         chat.otherUser?.email?.charAt(0)?.toUpperCase() || 
         '?';
}

function getChatOnlineStatus(chat) {
  if (chat.type === 'group') {
    return null;
  }
  return chat.otherUser?.isOnline || false;
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
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

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
          type: chat.type || 'direct',
          otherUser: chat.otherUser,
          name: chat.name,
          members: chat.members,
          lastMessage: null,
          createdAt: chat.createdAt,
        });
        setSearch('');
      })
      .catch(console.error);
  };
  const createGroup = () => {
    if (!user?.id) {
      console.error('User ID not found');
      alert('User not logged in. Please refresh the page.');
      return;
    }
    if (!groupName.trim() || selectedMembers.length < 1) {
      console.log('Validation failed:', { groupName: groupName.trim(), selectedMembers: selectedMembers.length });
      alert('Please enter a group name and select at least one member.');
      return;
    }
    const trimmedName = groupName.trim();
    
    // Validate and prepare memberIds
    if (!user.id) {
      alert('User ID is missing. Please refresh the page.');
      return;
    }
    
    // Combine user ID with selected members and remove duplicates
    const allMemberIds = [user.id, ...selectedMembers];
    const memberIds = [...new Set(allMemberIds)].filter(id => id != null && id !== '');
    
    // Validate data before sending
    if (!trimmedName || trimmedName.length === 0) {
      alert('Group name cannot be empty.');
      return;
    }
    
    if (!Array.isArray(memberIds) || memberIds.length < 2) {
      alert(`Invalid member list. Need at least 2 members (including yourself). Current: ${memberIds.length}`);
      console.error('Member IDs validation failed:', { memberIds, length: memberIds.length, user: user.id, selected: selectedMembers });
      return;
    }
    
    console.log('Creating group:', { 
      name: trimmedName, 
      nameLength: trimmedName.length,
      memberIds, 
      memberIdsLength: memberIds.length,
      memberIdsIsArray: Array.isArray(memberIds),
      user: { id: user.id },
      selectedMembers
    });
    setCreatingGroup(true);
    const requestBody = { name: trimmedName, memberIds };
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    axios
      .post(
        `${API}/api/chats`,
        requestBody,
        { headers: getAuthHeader() }
      )
      .then((res) => {
        console.log('Group created successfully:', res.data);
        const chat = res.data;
        onChatsUpdate();
        onSelectChat({
          id: chat.id,
          type: chat.type || 'group',
          name: chat.name,
          members: chat.members,
          lastMessage: null,
          createdAt: chat.createdAt,
        });
        setGroupName('');
        setSelectedMembers([]);
        setShowNewGroup(false);
        setShowNewChat(false);
        setSearch('');
      })
      .catch((err) => {
        console.error('Failed to create group - Full error:', err);
        console.error('Error response:', err.response);
        console.error('Error response data:', err.response?.data);
        const errorMessage = err.response?.data?.message || err.message || 'Failed to create group';
        console.error('Error message:', errorMessage);
        alert(`Error: ${errorMessage}\n\nCheck console for details.`);
      })
      .finally(() => {
        setCreatingGroup(false);
      });
  };

  const toggleMemberSelection = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
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
                const isSelected = selectedChat?.id === chat.id;
                const displayName = getChatDisplayName(chat);
                const avatar = getChatAvatar(chat);
                const isOnline = getChatOnlineStatus(chat);
                return (
                  <button
                    type="button"
                    key={chat.id}
                    className={`chat-list-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelectChat(chat)}
                  >
                    <div className="chat-list-avatar">
                      <span>{avatar}</span>
                      {isOnline && <span className="chat-online-dot" />}
                    </div>
                    <div className="chat-list-info">
                      <span className="chat-list-name">{displayName}</span>
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
                {!showNewGroup ? (
                  <>
                    <div className="sidebar-search">
                      <input
                        type="text"
                        placeholder="Search users"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div style={{ padding: '8px', borderBottom: '1px solid #e0e0e0' }}>
                      <button
                        type="button"
                        onClick={() => setShowNewGroup(true)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: '#25D366',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '500',
                        }}
                      >
                        + New Group
                      </button>
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
                  </>
                ) : (
                  <>
                    <div className="sidebar-search">
                      <input
                        type="text"
                        placeholder="Group name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (groupName.trim() && selectedMembers.length >= 1 && !creatingGroup) {
                              createGroup();
                            }
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <div style={{ padding: '8px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewGroup(false);
                          setGroupName('');
                          setSelectedMembers([]);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#f0f0f0',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          createGroup();
                        }}
                        disabled={!groupName.trim() || selectedMembers.length < 1 || creatingGroup}
                        style={{
                          flex: 1,
                          padding: '8px 16px',
                          background: groupName.trim() && selectedMembers.length >= 1 && !creatingGroup ? '#25D366' : '#ccc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: groupName.trim() && selectedMembers.length >= 1 && !creatingGroup ? 'pointer' : 'not-allowed',
                          fontWeight: '500',
                        }}
                      >
                        {creatingGroup ? 'Creating...' : `Create (${selectedMembers.length + 1})`}
                      </button>
                    </div>
                    <div style={{ padding: '8px', fontSize: '12px', color: '#666' }}>
                      Select members ({selectedMembers.length} selected)
                    </div>
                    <div className="user-list">
                      {filteredUsers.map((u) => {
                        const isSelected = selectedMembers.includes(u.id);
                        return (
                          <button
                            type="button"
                            key={u.id}
                            className="chat-list-item"
                            onClick={() => toggleMemberSelection(u.id)}
                            style={{
                              background: isSelected ? '#e8f5e9' : 'transparent',
                            }}
                          >
                            <div className="chat-list-avatar">
                              <span>{u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || '?'}</span>
                              {isSelected && (
                                <span style={{ marginLeft: '8px', color: '#25D366', fontWeight: 'bold' }}>✓</span>
                              )}
                            </div>
                            <div className="chat-list-info">
                              <span className="chat-list-name">{u.name || u.email}</span>
                              <span className="chat-list-preview">{u.email}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
    </aside>
  );
}
