import './CallsPage.css';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function CallsPage({ calls = [], users = [], currentUserId }) {
  if (!calls.length) {
    return (
      <div className="calls-page-empty">
        <p>No calls yet</p>
        <span>Start a call from any direct chat.</span>
      </div>
    );
  }

  return (
    <div className="calls-page">
      {calls.map((call) => {
        const peer = users.find((u) => u.id === call.peerUserId);
        const name = peer ? (peer.name || peer.email || 'Unknown') : 'Unknown';
        const isOutgoing = call.direction === 'outgoing';
        const isAudio = call.callType === 'audio';
        const icon = isAudio ? '📞' : '📹';
        const dirLabel = isOutgoing ? 'Outgoing' : 'Incoming';
        const statusLabel = call.status === 'cancelled' ? 'Missed' : 'Completed';
        return (
          <div key={call.id} className="calls-row">
            <div className="calls-avatar">
              <span>{name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="calls-main">
              <div className="calls-name">{name}</div>
              <div className="calls-meta">
                <span>{dirLabel}</span>
                <span>·</span>
                <span>{statusLabel}</span>
              </div>
            </div>
            <div className="calls-right">
              <span className="calls-time">{formatTime(call.createdAt)}</span>
              <span className="calls-icon" title={call.callType}>
                {icon}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

