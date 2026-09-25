import { useCallback, useEffect, useRef, useState } from 'react';

const peerConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function useCall({ userRef, socketRef }) {
  const [callStatus, setCallStatus] = useState('idle');
  const [callerInfo, setCallerInfo] = useState({ name: '', from: '' });
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);

  const setupMedia = async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (error) {
      console.warn('Video device not found, falling back to audio-only...', error);
      stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const createPeerConnection = (targetUid) => {
    const peerConnection = new RTCPeerConnection(peerConfig);
    peerConnectionRef.current = peerConnection;
    const socket = socketRef.current;
    localStreamRef.current?.getTracks().forEach((track) => peerConnection.addTrack(track, localStreamRef.current));
    peerConnection.ontrack = (event) => setRemoteStream(event.streams[0]);
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) socket?.emit('ice_candidate', { target: event.candidate, to: targetUid });
    };
    return peerConnection;
  };

  const endCallCleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setIncomingSignal(null);
    iceCandidateQueueRef.current = [];
  }, []);

  const registerSocketListeners = useCallback((socket) => {
    socket.on('incoming_call', ({ signal, from, name }) => {
      setCallerInfo({ name, from });
      setIncomingSignal(signal);
      setCallStatus('incoming');
    });
    socket.on('call_accepted', async (signal) => {
      setCallStatus('connected');
      if (localStreamRef.current) setLocalStream(localStreamRef.current);
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
      while (iceCandidateQueueRef.current.length) {
        const candidate = iceCandidateQueueRef.current.shift();
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (error) { console.error('Error adding queued ice candidate:', error); }
      }
    });
    socket.on('ice_candidate', async (candidate) => {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;
      if (peerConnection.remoteDescription?.type) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (error) { console.error('Error adding received ice candidate:', error); }
      } else {
        iceCandidateQueueRef.current.push(candidate);
      }
    });
    socket.on('call_ended', endCallCleanup);
    return () => {
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('ice_candidate');
      socket.off('call_ended', endCallCleanup);
    };
  }, [endCallCleanup]);

  const startCall = async (userToCall) => {
    if (callStatus !== 'idle') return;
    try {
      setCallStatus('calling');
      setCallerInfo({ name: userToCall.name, from: userToCall.uid });
      const stream = await setupMedia();
      const peerConnection = createPeerConnection(userToCall.uid);
      const senders = peerConnection.getSenders();
      stream.getTracks().forEach((track) => {
        if (!senders.some((sender) => sender.track === track)) peerConnection.addTrack(track, stream);
      });
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
        socketRef.current?.emit('start_call', { signal: offer, to: userToCall.uid, name: userRef.current?.displayName || 'User' });
    } catch (error) {
      console.error('Media devices error:', error);
      alert('Could not access your camera or microphone. Please check your device connections and browser permissions.');
      setCallStatus('idle');
    }
  };

  const acceptCall = async () => {
    const socket = socketRef.current;
    setCallStatus('connected');
    await setupMedia();
    const peerConnection = createPeerConnection(callerInfo.from);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingSignal));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket?.emit('answer_call', { signal: answer, to: callerInfo.from });
  };

  const handleHangup = () => {
    socketRef.current?.emit('hangup_call', { to: callerInfo.from });
    endCallCleanup();
  };

  const controllerRef = useRef(null);
  useEffect(() => {
    controllerRef.current = { registerSocketListeners };
  }, [registerSocketListeners]);

  return {
    callStatus,
    callerInfo,
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    handleHangup,
    endCallCleanup,
    registerSocketListeners,
    controllerRef,
  };
}