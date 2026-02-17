import { useState } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import './MessageInput.css';

const API = import.meta.env.VITE_API_URL || '';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MessageInput({ chatId, onMessageSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const socket = useSocket();

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed || !chatId) return;

    setText('');
    setSending(true);

    const payload = { chatId, content: trimmed };

    if (socket) {
      socket.emit('send_message', payload);
      setSending(false);
      return;
    }

    axios
      .post(`${API}/api/messages`, payload, { headers: getAuthHeader() })
      .then((res) => onMessageSent(res.data))
      .catch(console.error)
      .finally(() => setSending(false));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="message-input-wrap">
      <textarea
        className="message-input-field"
        placeholder="Type a message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={sending}
      />
      <button
        type="button"
        className="message-input-send"
        onClick={sendMessage}
        disabled={!text.trim() || sending}
        title="Send"
      >
        {sending ? '…' : 'Send'}
      </button>
    </div>
  );
}
