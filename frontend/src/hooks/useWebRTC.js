import { useRef, useCallback, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTC(currentUserId) {
  const socket = useSocket();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerUserIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    peerUserIdRef.current = null;
    pendingCandidatesRef.current = [];
  }, []);

  const getLocalStream = useCallback(async (isVideo) => {
    const constraints = {
      audio: true,
      video: isVideo ? { facingMode: 'user' } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    return stream;
  }, []);

  const createPeerConnection = useCallback(
    (peerUserId, isInitiator, callType) => {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerUserIdRef.current = peerUserId;
      pendingCandidatesRef.current = [];

      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit('webrtc_signal', {
            toUserId: peerUserId,
            signal: { type: 'candidate', candidate: e.candidate },
          });
        }
      };

      pc.ontrack = (e) => {
        if (e.streams?.[0]) {
          remoteStreamRef.current = e.streams[0];
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          cleanup();
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket, cleanup]
  );

  const applySignal = useCallback(
    async (fromUserId, signal) => {
      if (!pcRef.current || fromUserId !== peerUserIdRef.current) return;
      const pc = pcRef.current;

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(signal);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (socket) {
          socket.emit('webrtc_signal', {
            toUserId: fromUserId,
            signal: answer,
          });
        }
        pendingCandidatesRef.current.forEach((c) => pc.addIceCandidate(c));
        pendingCandidatesRef.current = [];
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(signal);
        pendingCandidatesRef.current.forEach((c) => pc.addIceCandidate(c));
        pendingCandidatesRef.current = [];
      } else if (signal.type === 'candidate' && signal.candidate) {
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            pendingCandidatesRef.current.push(new RTCIceCandidate(signal.candidate));
          }
        } catch (err) {
          console.warn('addIceCandidate error', err);
        }
      }
    },
    [socket]
  );

  const startCall = useCallback(
    async (peerUserId, callType = 'video') => {
      if (!socket || !currentUserId) return null;
      cleanup();
      const isVideo = callType === 'video';
      try {
        const stream = await getLocalStream(isVideo);
        createPeerConnection(peerUserId, true, callType);
        const pc = pcRef.current;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_signal', {
          toUserId: peerUserId,
          signal: offer,
        });
        return stream;
      } catch (err) {
        console.error('startCall error', err);
        cleanup();
        return null;
      }
    },
    [socket, currentUserId, cleanup, getLocalStream, createPeerConnection]
  );

  const acceptCall = useCallback(
    async (peerUserId, callType = 'video') => {
      if (!socket || !currentUserId) return null;
      cleanup();
      const isVideo = callType === 'video';
      try {
        const stream = await getLocalStream(isVideo);
        createPeerConnection(peerUserId, false, callType);
        const pc = pcRef.current;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        return stream;
      } catch (err) {
        console.error('acceptCall error', err);
        cleanup();
        return null;
      }
    },
    [socket, currentUserId, cleanup, getLocalStream, createPeerConnection]
  );

  const endCall = useCallback(
    (peerUserId) => {
      if (socket && peerUserId) {
        socket.emit('call_end', { toUserId: peerUserId });
      }
      cleanup();
    },
    [socket, cleanup]
  );

  const sendSignal = useCallback(
    (toUserId, signal) => {
      if (socket) socket.emit('webrtc_signal', { toUserId, signal });
    },
    [socket]
  );

  useEffect(() => {
    if (!socket) return;
    const onSignal = ({ fromUserId, signal }) => applySignal(fromUserId, signal);
    socket.on('webrtc_signal', onSignal);
    return () => {
      socket.off('webrtc_signal', onSignal);
    };
  }, [socket, applySignal]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    localStreamRef,
    remoteStreamRef,
    pcRef,
    startCall,
    acceptCall,
    endCall,
    sendSignal,
    cleanup,
    applySignal,
  };
}