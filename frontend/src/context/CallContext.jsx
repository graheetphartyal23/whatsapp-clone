import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { user } = useAuth();
  const socket = useSocket();
  const currentUserId = user?.id;

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [outgoingRinging, setOutgoingRinging] = useState(null);
  const [callHistory, setCallHistory] = useState([]);

  const webrtc = useWebRTC(currentUserId);

  const clearCallState = useCallback(() => {
    setIncomingCall(null);
    setActiveCall(null);
    setOutgoingRinging(null);
    webrtc.cleanup();
  }, [webrtc]);

  const logCall = useCallback(
    (entry) => {
      setCallHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...entry,
          createdAt: entry.createdAt || new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    []
  );

  const startCall = useCallback(
    async (peerUserId, callType = 'video') => {
      if (!socket || !currentUserId) return;
      clearCallState();
      setOutgoingRinging({ peerUserId, callType });
      socket.emit('call_request', {
        toUserId: peerUserId,
        callType,
      });
    },
    [socket, currentUserId, clearCallState]
  );

  const acceptCall = useCallback(
    async () => {
      if (!incomingCall || !socket) return;
      const { fromUserId, callType } = incomingCall;
      socket.emit('call_accept', { fromUserId, toUserId: currentUserId });
      setIncomingCall(null);
      try {
        await webrtc.acceptCall(fromUserId, callType);
        setActiveCall({
          peerUserId: fromUserId,
          callType,
          isInitiator: false,
        });
      } catch (err) {
        console.error('acceptCall error', err);
        clearCallState();
      }
    },
    [incomingCall, socket, currentUserId, webrtc, clearCallState]
  );

  const rejectCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    socket.emit('call_reject', {
      fromUserId: incomingCall.fromUserId,
      toUserId: currentUserId,
    });
    setIncomingCall(null);
    webrtc.cleanup();
  }, [incomingCall, socket, currentUserId, webrtc]);

  const endCall = useCallback(() => {
    if (activeCall) {
      webrtc.endCall(activeCall.peerUserId);
      logCall({
        peerUserId: activeCall.peerUserId,
        callType: activeCall.callType,
        direction: activeCall.isInitiator ? 'outgoing' : 'incoming',
        status: 'ended',
      });
    } else if (outgoingRinging) {
      socket?.emit('call_end', { toUserId: outgoingRinging.peerUserId });
      logCall({
        peerUserId: outgoingRinging.peerUserId,
        callType: outgoingRinging.callType,
        direction: 'outgoing',
        status: 'cancelled',
      });
    }
    clearCallState();
  }, [activeCall, outgoingRinging, socket, webrtc, clearCallState, logCall]);

  useEffect(() => {
    if (!socket) return;

    const onIncomingCall = (payload) => {
      setIncomingCall({
        fromUserId: payload.fromUserId,
        callType: payload.callType || 'video',
        chatId: payload.chatId ?? null,
      });
    };

    const onCallAccepted = (payload) => {
      const { byUserId } = payload;
      if (!outgoingRinging || outgoingRinging.peerUserId !== byUserId) return;
      setOutgoingRinging(null);
      webrtc.startCall(byUserId, outgoingRinging.callType).then(() => {
        setActiveCall({
          peerUserId: byUserId,
          callType: outgoingRinging.callType,
          isInitiator: true,
        });
      });
    };

    const onCallRejected = () => {
      setOutgoingRinging(null);
      webrtc.cleanup();
    };

    const onCallEnded = () => {
      if (activeCall && !activeCall.isInitiator) {
        logCall({
          peerUserId: activeCall.peerUserId,
          callType: activeCall.callType,
          direction: 'incoming',
          status: 'ended',
        });
      }
      clearCallState();
    };

    const onCallError = (payload) => {
      console.error('Call error:', payload?.message);
      clearCallState();
    };

    socket.on('incoming_call', onIncomingCall);
    socket.on('call_accepted', onCallAccepted);
    socket.on('call_rejected', onCallRejected);
    socket.on('call_ended', onCallEnded);
    socket.on('call_error', onCallError);

    return () => {
      socket.off('incoming_call', onIncomingCall);
      socket.off('call_accepted', onCallAccepted);
      socket.off('call_rejected', onCallRejected);
      socket.off('call_ended', onCallEnded);
      socket.off('call_error', onCallError);
    };
  }, [socket, outgoingRinging, webrtc, clearCallState]);

  const value = {
    incomingCall,
    activeCall,
    outgoingRinging,
    callHistory,
    localStreamRef: webrtc.localStreamRef,
    remoteStreamRef: webrtc.remoteStreamRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    clearCallState,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}