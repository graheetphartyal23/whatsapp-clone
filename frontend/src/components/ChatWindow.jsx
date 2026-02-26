import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext'; 
import './ChatWindow.css';

function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusIcon(status) {
  if (status === 'read') return '✓✓';
  if (status === 'delivered') return '✓✓';
  if (status === 'sent') return '✓';
  return '✓';
}

export default function ChatWindow({
  chatType = 'direct',
  otherUser,
  chatName,
  members,
  messages,
  loading,
  currentUserId,
  nextCursor,
  loadingMore,
  onLoadOlder,
  onNewMessage,
  onStatusUpdate,
}) {
  const bottomRef = useRef(null);
  const socket = useSocket();
  const { startCall } = useCall();
  

  useEffect(() => {
    if (!socket) return;
    const handler = (message) => {
      onNewMessage(message);
      const sid = message.sender?.id || message.senderId;
      if (sid !== currentUserId && message.status === 'sent') {
        socket.emit('message_status_update', { messageId: message.id, status: 'delivered' });
      }
    };
    socket.on('receive_message', handler);
    return () => socket.off('receive_message', handler);
  }, [socket, onNewMessage, currentUserId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => onStatusUpdate(payload);
    socket.on('message_status_update', handler);
    return () => socket.off('message_status_update', handler);
  }, [socket, onStatusUpdate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isOwn = (msg) => {
    const sid = msg.sender?.id || msg.senderId;
    return sid === currentUserId;
  };

  return (
    <div className="chat-window">
      <header className="chat-window-header">
        <div className="chat-window-avatar">
          <span>
            {chatType === 'group'
              ? (chatName || 'Group').charAt(0).toUpperCase()
              : otherUser?.name?.charAt(0)?.toUpperCase() ||
                otherUser?.email?.charAt(0)?.toUpperCase() ||
                '?'}
          </span>
          {chatType === 'direct' && otherUser?.isOnline && (
            <span className="chat-online-dot" />
          )}
        </div>
        <div className="chat-window-info">
          <span className="chat-window-name">
            {chatType === 'group'
              ? chatName || 'Group'
              : otherUser?.name || otherUser?.email}
          </span>
          <span className="chat-window-status">
            {chatType === 'group'
              ? `${members?.length || 0} members`
              : otherUser?.isOnline
              ? 'Online'
              : 'Offline'}
          </span>
        </div>
        {chatType === 'direct' && otherUser && (
          <div className="chat-window-actions">
            <button
              type="button"
              className="call-btn voice-call-btn"
              onClick={() => startCall(otherUser.id, 'audio')}
              aria-label="Start voice call"
              title="Voice call"
            >
              📞
            </button>
            <button
              type="button"
              className="call-btn video-call-btn"
              onClick={() => startCall(otherUser.id, 'video')}
              aria-label="Start video call"
              title="Video call"
            >
              📸
            </button>
          </div>
        )}
      </header>
      <div className="chat-window-messages">
        {nextCursor && (
          <div className="load-more-wrap">
            <button
              type="button"
              className="load-more-btn"
              onClick={onLoadOlder}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}
        {loading ? (
          <p className="messages-loading">Loading messages...</p>
        ) : (
          messages.map((msg) => {
            const senderName = chatType === 'group' && !isOwn(msg) 
              ? (msg.sender?.name || msg.sender?.email || 'Unknown')
              : null;
            return (
              <div key={msg.id}
                className={`message-bubble ${isOwn(msg) ? 'out' : 'in'}`}>
                {senderName && (
                  <span className="message-sender-name" style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                    {senderName}
                  </span>
                )}
                <span className="message-text">{msg.content}</span>
                <span className="message-meta">
                  {formatMessageTime(msg.createdAt)}
                  {isOwn(msg) && (
                    <span className="message-status" title={msg.status}>
                      {statusIcon(msg.status)}
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
