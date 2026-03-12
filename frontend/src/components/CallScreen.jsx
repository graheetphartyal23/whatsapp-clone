import { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import './CallScreen.css';

export default function CallScreen({ users = [] }) {
  const { activeCall, outgoingRinging, localStreamRef, remoteStreamRef, endCall } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const callState = activeCall || outgoingRinging;

  // Attach local video stream once when active video call starts
  useEffect(() => {
    if (!activeCall) return;
    if (localStreamRef?.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [activeCall, localStreamRef]);

  // Attach remote video stream once when available
  useEffect(() => {
    if (!activeCall) return;
    if (remoteStreamRef?.current && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [activeCall, remoteStreamRef]);

  // Always attach remote audio (for voice-only and video)
  useEffect(() => {
    if (!callState) return;
    if (remoteStreamRef?.current && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
    }
  }, [callState, remoteStreamRef]);

  if (!callState) return null;

  const { peerUserId, callType } = callState;
  const peer = users.find((u) => u.id === peerUserId);
  const peerName = peer ? (peer.name || peer.email || 'Unknown') : 'Peer';
  const isVideo = callType === 'video';
  const isActive = !!activeCall;
  const statusText = isActive
    ? (isVideo ? 'In video call' : 'In voice call')
    : peer?.isOnline
    ? 'Ringing…'
    : 'Calling…';

  return (
    <div className="call-screen-overlay" role="dialog" aria-label="Active call">
      <div className="call-screen">
        <div className="call-screen-videos">
          <div className="call-remote-video">
            {isVideo && isActive ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="call-video"
              />
            ) : (
              <div className="call-voice-placeholder">
                <span className="call-voice-icon">{isVideo ? '📹' : '📞'}</span>
                <span>{peerName}</span>
                <span className="call-voice-label">
                  {isActive
                    ? isVideo
                      ? 'Video call'
                      : 'Voice call'
                    : statusText}
                </span>
              </div>
            )}
          </div>
          {isVideo && isActive && (
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
          {/* Hidden audio element to play remote audio for voice/video calls */}
          <audio ref={remoteAudioRef} autoPlay playsInline className="call-remote-audio" />
        </div>
        <div className="call-screen-info">
          <span className="call-screen-peer">{peerName}</span>
          <span className="call-screen-type">{statusText}</span>
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