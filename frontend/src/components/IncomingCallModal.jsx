import { useCall } from '../context/CallContext';
import './IncomingCallModal.css';

export default function IncomingCallModal({ users = [] }) {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  const { fromUserId, callType } = incomingCall;
  const caller = users.find((u) => u.id === fromUserId);
  const callerName = caller ? (caller.name || caller.email || 'Unknown') : 'Someone';
  const callerInitial = callerName.charAt(0).toUpperCase();
  const isVideo = callType === 'video';

  return (
    <div className="incoming-call-overlay" role="dialog" aria-label="Incoming call">
      <div className="incoming-call-modal">
        <div className="incoming-call-avatar">
          <span>{callerInitial}</span>
        </div>
        <p className="incoming-call-title">
          {isVideo ? 'Incoming video call' : 'Incoming voice call'}
        </p>
        <p className="incoming-call-caller">{callerName}</p>
        <div className="incoming-call-actions">
          <button
            type="button"
            className="incoming-call-reject"
            onClick={rejectCall}
            aria-label="Reject call"
          >
            Reject
          </button>
          <button
            type="button"
            className="incoming-call-accept"
            onClick={acceptCall}
            aria-label="Accept call"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}