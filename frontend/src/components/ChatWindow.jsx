import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
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
  otherUser,
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
            {otherUser?.name?.charAt(0)?.toUpperCase() ||
              otherUser?.email?.charAt(0)?.toUpperCase() ||
              '?'}
          </span>
          {otherUser?.isOnline && <span className="chat-online-dot" />}
        </div>
        <div className="chat-window-info">
          <span className="chat-window-name">{otherUser?.name || otherUser?.email}</span>
          <span className="chat-window-status">
            {otherUser?.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
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
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-bubble ${isOwn(msg) ? 'out' : 'in'}`}
            >
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
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
