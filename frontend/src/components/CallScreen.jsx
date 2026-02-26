import { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import './CallScreen.css';

export default function CallScreen({ users = [] }) {
  const { activeCall, localStreamRef, remoteStreamRef, endCall } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Sync stream refs to video elements (refs update asynchronously)
  useEffect(() => {
    if (!activeCall) return;
    const interval = setInterval(() => {
      if (localStreamRef?.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      if (remoteStreamRef?.current && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    }, 200);
    return () => clearInterval(interval);
  }, [activeCall, localStreamRef, remoteStreamRef]);

  if (!activeCall) return null;

  const { peerUserId, callType } = activeCall;
  const peer = users.find((u) => u.id === peerUserId);
  const peerName = peer ? (peer.name || peer.email || 'Unknown') : 'Peer';
  const isVideo = callType === 'video';

  return (
    <div className="call-screen-overlay" role="dialog" aria-label="Active call">
      <div className="call-screen">
        <div className="call-screen-videos">
          <div className="call-remote-video">
            {isVideo ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="call-video"
              />
            ) : (
              <div className="call-voice-placeholder">
                <span className="call-voice-icon">🎤</span>
                <span>{peerName}</span>
                <span className="call-voice-label">Voice call</span>
              </div>
            )}
          </div>
          {isVideo && (
            <div className="call-local-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="call-video call-video-pip"
              />
            </div>
          )}
        </div>
        <div className="call-screen-info">
          <span className="call-screen-peer">{peerName}</span>
          <span className="call-screen-type">{isVideo ? 'Video call' : 'Voice call'}</span>
        </div>
        <div className="call-screen-controls">
          <button
            type="button"
            className="call-end-btn"
            onClick={() => endCall()}
            aria-label="End call"
          >
            End call
          </button>
        </div>
      </div>
    </div>
  );
}