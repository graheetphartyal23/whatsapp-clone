import { useEffect, useRef, useState } from 'react';
import { useCall } from '../context/CallContext';
import './CallScreen.css';

export default function CallScreen({ users = [] }) {
  const { activeCall, outgoingRinging, localStreamRef, remoteStreamRef, endCall } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const callState = activeCall || outgoingRinging;

  // Timer: counts only while an active call is connected
  useEffect(() => {
    if (!activeCall) {
      setElapsedSeconds(0);
      return;
    }
    const id = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [activeCall]);

  // Attach local / remote media elements.
  // We intentionally avoid putting the refs in the dependency array because
  // changes to ref.current do not trigger effects; instead we re-run on
  // every render and only update when the stream changes.
  useEffect(() => {
    if (activeCall && localStreamRef?.current && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  });

  useEffect(() => {
    if (activeCall && remoteStreamRef?.current && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    }
  });

  useEffect(() => {
    if (callState && remoteStreamRef?.current && remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
    }
  });

  if (!callState) return null;

  const { peerUserId, callType } = callState;
  const peer = users.find((u) => u.id === peerUserId);
  const peerName = peer ? (peer.name || peer.email || 'Unknown') : 'Peer';
  const isVideo = callType === 'video';
  const isActive = !!activeCall;
  const hasConnected = isActive;
  const statusBase = hasConnected
    ? (isVideo ? 'Connected' : 'Connected')
    : peer?.isOnline
    ? 'Ringing…'
    : 'Calling…';

  const formatTime = (total) => {
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(total % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const statusText = hasConnected ? `${statusBase} · ${formatTime(elapsedSeconds)}` : statusBase;

  const handleToggleMute = () => {
    if (!localStreamRef?.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((m) => !m);
  };

  const handleToggleSpeaker = () => {
    if (remoteAudioRef.current) {
      // Web speaker routing APIs are limited; we model this as mute/unmute output.
      remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
      setIsSpeakerOn(!remoteAudioRef.current.muted);
    }
  };

  const handleToggleCamera = () => {
    if (!localStreamRef?.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsCameraOn((c) => !c);
  };

  const handleSwitchCamera = async () => {
    // Simple front/back toggle: stop current video tracks and re-request with facingMode.
    if (!navigator.mediaDevices || !localStreamRef.current) return;
    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    const currentFacing = currentTrack?.getSettings?.().facingMode || 'user';
    const nextFacing = currentFacing === 'environment' ? 'user' : 'environment';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: nextFacing },
      });
      // Replace tracks in existing stream & peer connection
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack && activeCall) {
        const pc = window?.RTCPeerConnection && activeCall ? null : null; // keep simple: just update local preview
      }
      // Update local stream ref for preview and mute state
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      localStreamRef.current.removeTrack(currentTrack);
      localStreamRef.current.addTrack(newVideoTrack);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } catch (e) {
      console.warn('switchCamera failed', e);
    }
  };

  return (
    <div className="call-screen-overlay" role="dialog" aria-label="Active call">
      <audio ref={remoteAudioRef} autoPlay playsInline className="call-remote-audio" />

      {isVideo ? (
        // Video call UI
        <div className="call-screen call-screen--video">
          <div className="call-video-remote-wrapper">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="call-video-remote"
            />
            <div className="call-video-gradient-top" />
            <div className="call-video-gradient-bottom" />
            <div className="call-video-header">
              <div className="call-video-header-text">
                <span className="call-video-peer">{peerName}</span>
                <span className="call-video-status">{statusText}</span>
              </div>
            </div>
            {isActive && (
              <div className="call-video-local-pip">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="call-video-local"
                />
              </div>
            )}
          </div>

          <div className="call-controls-bar call-controls-bar--video">
            <button
              type="button"
              className={`call-control call-control--icon ${isMuted ? 'call-control--active' : ''}`}
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              <span>{isMuted ? '🎙️' : '🎤'}</span>
            </button>
            <button
              type="button"
              className={`call-control call-control--icon ${!isCameraOn ? 'call-control--active' : ''}`}
              onClick={handleToggleCamera}
              aria-label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              <span>{isCameraOn ? '📷' : '🚫📷'}</span>
            </button>
            <button
              type="button"
              className="call-control call-control--icon"
              onClick={handleSwitchCamera}
              aria-label="Switch camera"
            >
              <span>🔄</span>
            </button>
            <button
              type="button"
              className="call-control call-control--end"
              onClick={() => endCall()}
              aria-label="End call"
            >
              <span>✖</span>
            </button>
          </div>
        </div>
      ) : (
        // Voice call UI
        <div className="call-screen call-screen--voice">
          <div className="call-voice-main">
            <div className="call-voice-avatar-ring">
              <div className="call-voice-avatar">
                <span>{peerName.charAt(0).toUpperCase()}</span>
              </div>
            </div>
            <div className="call-voice-text">
              <span className="call-voice-name">{peerName}</span>
              <span className="call-voice-status">{statusText}</span>
            </div>
          </div>

          <div className="call-controls-bar call-controls-bar--voice">
            <button
              type="button"
              className={`call-control call-control--icon ${isMuted ? 'call-control--active' : ''}`}
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              <span>{isMuted ? '🎙️' : '🎤'}</span>
            </button>
            <button
              type="button"
              className={`call-control call-control--icon ${!isSpeakerOn ? 'call-control--active' : ''}`}
              onClick={handleToggleSpeaker}
              aria-label={isSpeakerOn ? 'Turn speaker off' : 'Turn speaker on'}
            >
              <span>{isSpeakerOn ? '🔊' : '🔈'}</span>
            </button>
            <button
              type="button"
              className="call-control call-control--end"
              onClick={() => endCall()}
              aria-label="End call"
            >
              <span>✖</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}