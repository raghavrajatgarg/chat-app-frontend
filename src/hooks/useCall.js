import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

// STUN alone only succeeds when both peers can be reached directly. On mobile
// carriers, symmetric NAT and corporate Wi-Fi a TURN relay is required,
// otherwise signalling "succeeds" but the media never starts (silent call,
// black video). Configure your own relay with VITE_TURN_* env vars.
const buildIceServers = () => {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((url) => url.trim()),
      username: turnUsername,
      credential: turnCredential,
    });
  } else {
    // Public fallback relay so 1:1 calls work out of the box. Replace this with
    // your own TURN deployment (coturn / Metered / Twilio) for production.
    servers.push(
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    );
  }

  return servers;
};

const peerConfig = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 4,
};

const isNativePlatform = () => Capacitor.isNativePlatform();

const getIncomingCallKit = async () => {
  if (!isNativePlatform()) return null;
  try {
    const { IncomingCallKit } = await import(
      "@capgo/capacitor-incoming-call-kit"
    );
    return IncomingCallKit ?? null;
  } catch (error) {
    console.warn("Incoming call kit is unavailable:", error);
    return null;
  }
};

const getCallConnection = async () => {
  if (!isNativePlatform()) return null;
  try {
    return Capacitor.registerPlugin("CallConnection");
  } catch (error) {
    console.warn("Call foreground plugin unavailable:", error);
    return null;
  }
};

export default function useCall({ userRef, socketRef }) {
  const [callStatus, setCallStatus] = useState("idle");
  const [callerInfo, setCallerInfo] = useState({ name: "", from: "" });
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const remoteUidRef = useRef("");
  const nativeCallShownRef = useRef("");
  // Our own gathered candidates. When the callee answers from a cold start its
  // socket was not in the room yet, so the ones we already emitted were dropped
  // and have to be replayed once the answer proves it is listening.
  const localCandidatesRef = useRef([]);

  // Ask the OS/WebView for camera + mic up-front (while the app is definitely in
  // the foreground) so a cold-start lock-screen accept does not stall waiting on
  // a runtime permission dialog that cannot be shown over the lock screen.
  const warmUpMediaPermissions = useCallback(async () => {
    if (!isNativePlatform() || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
      } catch (audioError) {
        console.warn("Media permission warm-up failed:", audioError);
      }
    }
  }, []);

  // Keep the WebView (and therefore the live WebRTC connection) alive while a
  // call is in progress, so it survives screen-off / backgrounding.
  const startCallForeground = useCallback(async () => {
    const plugin = await getCallConnection();
    try {
      await plugin?.start();
    } catch (error) {
      console.warn("Failed to start call foreground service:", error);
    }
  }, []);

  const stopCallForeground = useCallback(async () => {
    const plugin = await getCallConnection();
    try {
      await plugin?.stop();
    } catch (error) {
      console.warn("Failed to stop call foreground service:", error);
    }
  }, []);

  // Pulls the offer the server stored for this callee. Used when answering from
  // a lock-screen notification, where the JS layer has no SDP yet.
  const requestPendingOffer = useCallback((socket, timeoutMs = 6000) => {
    if (!socket) return Promise.resolve(null);
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, timeoutMs);
      try {
        socket.emit("request_pending_call", {}, (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(response?.call?.signal ? response.call : null);
        });
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      }
    });
  }, []);

  const setupMedia = async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (error) {
      console.warn(
        "Video device not found, falling back to audio-only...",
        error,
      );
      stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const createPeerConnection = (targetUid) => {
    const peerConnection = new RTCPeerConnection(peerConfig);
    peerConnectionRef.current = peerConnection;

    localStreamRef.current
      ?.getTracks()
      .forEach((track) =>
        peerConnection.addTrack(track, localStreamRef.current),
      );

    peerConnection.ontrack = (event) => setRemoteStream(event.streams[0]);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        localCandidatesRef.current.push(event.candidate);
        const socket = socketRef.current;
        // If the socket connection isn't established yet, wait for it to become alive
        if (socket && socket.connected) {
          socket.emit("ice_candidate", {
            target: event.candidate,
            to: targetUid,
          });
        } else {
          // Fallback interval watcher to pump candidates out once socket bridges online
          const checkInterval = setInterval(() => {
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit("ice_candidate", {
                target: event.candidate,
                to: targetUid,
              });
              clearInterval(checkInterval);
            }
          }, 500);
        }
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log("RTC connection state:", peerConnection.connectionState);
    };
    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peerConnection.iceConnectionState);
    };

    return peerConnection;
  };

  // Raise the OS level (lock screen / full screen) incoming call UI. Safe to
  // call repeatedly for the same caller: the plugin reuses the callId so the
  // notification is replaced instead of duplicated.
  const showNativeIncomingCall = useCallback(async ({ from, name, signal }) => {
    if (!from) return;
    // If the app is already in the foreground the in-app modal is ringing, so
    // raising the OS full-screen call too would show two competing UIs.
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      return;
    }
    const IncomingCallKit = await getIncomingCallKit();
    if (!IncomingCallKit) return;
    try {
      nativeCallShownRef.current = from;
      await IncomingCallKit.showIncomingCall({
        callId: from,
        callerName: name || "Incoming Call",
        handle: "Video call",
        appName: "Chat App",
        hasVideo: true,
        timeoutMs: 60000,
        extra: {
          fromUid: from,
          callerName: name || "Incoming Call",
          roomId: from,
          signalOffer: JSON.stringify(signal),
        },
        android: {
          channelId: "incoming_call_kit",
          channelName: "Incoming Calls",
          showFullScreen: true,
        },
      });
    } catch (error) {
      console.warn("Failed to show native incoming call UI:", error);
    }
  }, []);

  const dismissNativeCall = useCallback(async () => {
    const shownId = nativeCallShownRef.current;
    nativeCallShownRef.current = "";
    const IncomingCallKit = await getIncomingCallKit();
    if (!IncomingCallKit) return;
    try {
      if (shownId) {
        await IncomingCallKit.endCall({ callId: shownId, reason: "ended" });
      } else {
        await IncomingCallKit.endAllCalls({ reason: "ended" });
      }
    } catch (error) {
      console.warn("Failed to dismiss native call UI:", error);
    }
  }, []);

  // Remote ICE candidates that arrive before the remote description is set have
  // to be replayed afterwards, otherwise the connection never completes.
  const flushQueuedIceCandidates = useCallback(async (peerConnection) => {
    if (!peerConnection) return;
    while (iceCandidateQueueRef.current.length) {
      const candidate = iceCandidateQueueRef.current.shift();
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error adding queued ice candidate:", error);
      }
    }
  }, []);

  // Re-emits our cached local candidates to `to`. Used after the remote answer
  // arrives, i.e. once the callee is definitely connected and listening.
  const replayLocalIceCandidates = useCallback((socket, to) => {
    if (!socket || !to || !localCandidatesRef.current.length) return;
    localCandidatesRef.current.forEach((candidate) => {
      socket.emit("ice_candidate", { target: candidate, to });
    });
  }, []);

  // On a cold boot the native accept can fire before authentication and the
  // Socket.IO handshake finish, so wait for a connected transport.
  const waitForSocket = useCallback(async (timeoutMs = 15000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const socket = socketRef.current;
      if (socket?.connected) return socket;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return socketRef.current?.connected ? socketRef.current : null;
  }, [socketRef]);

  const endCallCleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    remoteUidRef.current = "";
    dismissNativeCall();
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setIncomingSignal(null);
    iceCandidateQueueRef.current = [];
    localCandidatesRef.current = [];
    stopCallForeground();
  }, [dismissNativeCall, stopCallForeground]);

  const registerSocketListeners = useCallback(
    (socket) => {
      socket.on("incoming_call", ({ signal, from, name }) => {
        remoteUidRef.current = from;
        setCallerInfo({ name, from });
        setIncomingSignal(signal);
        setCallStatus("incoming");
        // Native build: also raise the OS incoming-call surface so the call can
        // be answered from the lock screen or the notification shade.
        if (isNativePlatform()) showNativeIncomingCall({ from, name, signal });
      });
      socket.on("call_accepted", async (signal) => {
        setCallStatus("connected");
        if (localStreamRef.current) setLocalStream(localStreamRef.current);
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection) return;
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(signal),
        );
        await flushQueuedIceCandidates(peerConnection);
        // The callee may have been asleep when we gathered our candidates, so
        // replay them now that its socket is guaranteed to be in the room.
        replayLocalIceCandidates(socket, remoteUidRef.current);
      });
      socket.on("ice_candidate", async (candidate) => {
        const peerConnection = peerConnectionRef.current;
        // Candidates can arrive before the call is answered (no peer connection
        // yet) or before the remote description is applied. Dropping them here
        // is what makes calls connect on signalling but stay silent, so queue
        // them and replay once the connection is ready.
        if (!peerConnection || !peerConnection.remoteDescription?.type) {
          iceCandidateQueueRef.current.push(candidate);
          return;
        }
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding received ice candidate:", error);
        }
      });
      socket.on("call_ended", endCallCleanup);
      return () => {
        socket.off("incoming_call");
        socket.off("call_accepted");
        socket.off("ice_candidate");
        socket.off("call_ended", endCallCleanup);
      };
    },
    [endCallCleanup, flushQueuedIceCandidates, showNativeIncomingCall, replayLocalIceCandidates],
  );

  const startCall = async (userToCall) => {
    if (callStatus !== "idle") return;
    try {
      setCallStatus("calling");
      startCallForeground();
      remoteUidRef.current = userToCall.uid;
      iceCandidateQueueRef.current = [];
      localCandidatesRef.current = [];
      setCallerInfo({ name: userToCall.name, from: userToCall.uid });
      const stream = await setupMedia();
      const peerConnection = createPeerConnection(userToCall.uid);
      const senders = peerConnection.getSenders();
      stream.getTracks().forEach((track) => {
        if (!senders.some((sender) => sender.track === track))
          peerConnection.addTrack(track, stream);
      });
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socketRef.current?.emit("start_call", {
        signal: offer,
        to: userToCall.uid,
        name: userRef.current?.displayName || "User",
      });
    } catch (error) {
      console.error("Media devices error:", error);
      alert(
        "Could not access your camera or microphone. Please check your device connections and browser permissions.",
      );
      setCallStatus("idle");
    }
  };

  // Accepts an incoming call. `backgroundCallData` is only supplied by the
  // native call-kit event / cold-boot recovery path ({ fromUid, signalOffer }).
  // React click handlers pass the DOM event as the first argument, so we must
  // verify the payload actually carries signalling data before trusting it.
  const acceptCall = async (backgroundCallData = null) => {
    const nativeCallData =
      backgroundCallData &&
      typeof backgroundCallData === "object" &&
      (backgroundCallData.signalOffer || backgroundCallData.fromUid)
        ? backgroundCallData
        : null;

    let remoteUid =
      nativeCallData?.fromUid || remoteUidRef.current || callerInfo.from;
    let incomingSdp = nativeCallData?.signalOffer || incomingSignal;

    // The SDP is no longer shipped inside the FCM push (FCM data is capped at
    // 4 KB). When answering from a lock-screen notification the JS side has no
    // offer yet, so pull the one the server stored for us.
    if (!incomingSdp) {
      const socket = await waitForSocket();
      const pending = await requestPendingOffer(socket);
      if (pending?.signal) {
        incomingSdp = pending.signal;
        remoteUid = pending.from || remoteUid;
      }
    }

    if (!remoteUid || !incomingSdp) {
      console.error("Cannot accept call - missing peer or offer", {
        remoteUid,
        hasOffer: Boolean(incomingSdp),
      });
      return;
    }

    remoteUidRef.current = remoteUid;
    setCallerInfo((prev) =>
      prev.from ? prev : { name: prev.name, from: remoteUid },
    );
    setCallStatus("connected");
    startCallForeground();

    try {
      await setupMedia();
    } catch (error) {
      console.error("Media devices error:", error);
      alert(
        "Could not access your camera or microphone. Please check your device connections and browser permissions.",
      );
      endCallCleanup();
      return;
    }

    // Drop any stale connection before building the answering one.
    peerConnectionRef.current?.close();
    localCandidatesRef.current = [];
    const peerConnection = createPeerConnection(remoteUid);

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(incomingSdp),
      );
      await flushQueuedIceCandidates(peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      const socket = await waitForSocket();
      socket?.emit("answer_call", { signal: answer, to: remoteUid });
      dismissNativeCall();
    } catch (error) {
      console.error("Failed to answer call:", error);
      endCallCleanup();
    }
  };

  const handleHangup = (targetUid) => {
    const to =
      typeof targetUid === "string"
        ? targetUid
        : remoteUidRef.current || callerInfo.from;
    if (to) socketRef.current?.emit("hangup_call", { to });
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
    warmUpMediaPermissions,
  };
}
