import { useState, useEffect, useRef, useCallback } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { io } from 'socket.io-client';
import { auth, googleProvider } from './firebase';
import styles from './App.module.css';
import { getMessaging, getToken } from "firebase/messaging";

import LoginCard from './components/LoginCard';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DeleteModal from './components/DeleteModal';
import ChatFeed from './components/ChatFeed';
import TypingIndicator from './components/TypingIndicator';
import ChatInputForm from './components/ChatInputForm';
import ThreadView from './components/ThreadView';
import InfoModal from './components/InfoModal.jsx';
import EditMessageModal from './components/EditMessageModal';
import CallModal from "./components/CallModal";
import ScreenCaptureModal from './components/ScreenCaptureModal';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://chat-app-backend-1yfa.onrender.com';
const ROOMS_LIST = ['general', 'tech', 'random', 'gaming'];
const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [room, setRoom] = useState('general');
  const [roomLoading, setRoomLoading] = useState(false);
  const [deleteModalMessageId, setDeleteModalMessageId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({ general: 0, tech: 0, random: 0, gaming: 0 });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); 
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null); 
  const [editingText, setEditingText] = useState(''); 
  const [searchQuery, setSearchQuery] = useState('');
  const [allRegisteredUsers, setAllRegisteredUsers] = useState([]);
  const [infoModalMessage, setInfoModalMessage] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadInput, setThreadInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [callStatus, setCallStatus] = useState("idle"); // idle, calling, incoming, connected
  const [callerInfo, setCallerInfo] = useState({ name: "", from: "" });
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false); // Make sure it reads 'isStudioOpen'
  const [captureType, setCaptureType] = useState('screen'); // 'screen' or 'camera'



  const roomRef = useRef(room);
  const socketRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const feedRef = useRef(null); 
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const isPrivateRoom = room.includes('_');

let activeHeaderTitle = room;
let activeHeaderAvatar = null;
let activeHeaderUser = null;

if (isPrivateRoom) {
  // Extract the other user's UID from the room string (e.g., 'uid1_uid2')
  const otherUid = room.split('_').find((id) => id !== user?.uid);
  const foundUser = allRegisteredUsers.find((u) => u.uid === otherUid);
  
  if (foundUser) {
    activeHeaderTitle = foundUser.name;
    activeHeaderAvatar = foundUser.avatar;
    activeHeaderUser = foundUser;
  }
} else {
  activeHeaderTitle = `# ${room}`;
}
  // Socket event listeners for signaling
// 1. Add an ICE candidate queue ref near your other refs
  const iceCandidateQueueRef = useRef([]);


  // Setup media tracks (WebRTC)
const setupMedia = async () => {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    console.warn("Video device not found, falling back to audio-only...", err);
    stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
  }
  
  localStreamRef.current = stream;
  setLocalStream(stream); // FIX: Update state so React re-renders video components
  if (localVideoRef.current) localVideoRef.current.srcObject = stream;
  return stream;
};

  const createPeerConnection = (targetUid) => {
    const pc = new RTCPeerConnection(peerConfig);
    peerConnectionRef.current = pc;
    const socket = socketRef.current;


    // Add local tracks to peer connection
    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    // Handle incoming remote stream tracks
pc.ontrack = (event) => {
  console.log("📺 Remote stream received:", event.streams[0]);
  setRemoteStream(event.streams[0]);
};
    // Send ICE candidates to peer via socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice_candidate", { target: event.candidate, to: targetUid });
      }
    };

    return pc;
  };
// Helper function to format last seen (can be placed inside App.jsx or imported)
const formatLastSeen = (dateString) => {
  if (!dateString) return 'Offline';

  const lastSeenDate = new Date(dateString);
  const now = new Date();
  const isToday = lastSeenDate.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = lastSeenDate.toDateString() === yesterday.toDateString();

  if (isToday) {
    return `Last seen at ${lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isYesterday) {
    return `Last seen yesterday at ${lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return `Last seen on ${lastSeenDate.toLocaleDateString([], options)}`;
  }
};

// Determine if the current room is a direct message or a public channel

if (isPrivateRoom) {
  const otherUid = room.split('_').find((id) => id !== user?.uid);
  const foundUser = allRegisteredUsers.find((u) => u.uid === otherUid);
  
  if (foundUser) {
    activeHeaderTitle = foundUser.name;
    activeHeaderAvatar = foundUser.avatar;
    activeHeaderUser = foundUser;
  }
} else {
  activeHeaderTitle = `# ${room}`;
}

// Check if the DM partner is currently online using activeUsers array
const isHeaderUserOnline = activeHeaderUser ? activeUsers.some((u) => u.uid === activeHeaderUser.uid) : false;
  // Triggered when User A clicks "Call" on Sidebar
const startCall = async (userToCall) => {
  if (callStatus !== "idle") return;

  try {
    setCallStatus("calling");
    setCallerInfo({ name: userToCall.name, from: userToCall.uid });
    
    let stream = await setupMedia(); // FIX: Use setupMedia helper to handle state and ref uniformly

    const pc = createPeerConnection(userToCall.uid);
    
    const senders = pc.getSenders();
    stream.getTracks().forEach((track) => {
      const alreadyExists = senders.some(sender => sender.track === track);
      if (!alreadyExists) {
        pc.addTrack(track, stream);
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit("start_call", {
      signal: offer,
      to: userToCall.uid,
      name: user?.name || "User"
    });
  } catch (err) {
    console.error("Media devices error:", err);
    alert("Could not access your camera or microphone. Please check your device connections and browser permissions.");
    setCallStatus("idle");
  }
};
  // Triggered when User B clicks "Accept"
  const acceptCall = async () => {
    const socket = socketRef.current;
    setCallStatus("connected");
    const stream = await setupMedia();
    const pc = createPeerConnection(callerInfo.from);

    await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer_call", { signal: answer, to: callerInfo.from });
  };

  // Terminate/Decline call cleanup
const endCallCleanup = () => {
  if (localStreamRef.current) {
    localStreamRef.current.getTracks().forEach((track) => track.stop());
  }
  if (peerConnectionRef.current) {
    peerConnectionRef.current.close();
    peerConnectionRef.current = null;
  }
  setLocalStream(null); // FIX: Clear local stream state
  setRemoteStream(null);
  setCallStatus("idle");
  setIncomingSignal(null);
};

  const handleHangup = () => {
    const socket = socketRef.current;
    socket.emit("hangup_call", { to: callerInfo.from });
    endCallCleanup();
  };
  // 1. Start Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setRecordedAudioUrl(audioUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone permission denied or error:", err);
      alert("Could not access microphone. Please check your browser permissions.");
    }
  };

  // 2. Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

const cancelRecording = () => {
  // 1. Stop the media recorder if it's running to release the microphone
  if (mediaRecorderRef.current && isRecording) {
    mediaRecorderRef.current.onstop = null; // Clear the onstop handler so it won't trigger save logic
    mediaRecorderRef.current.stop();
  }

  // 2. Reset all recording states completely
  setIsRecording(false);
  setRecordedAudioUrl(null); // Crucial: Setting this to null prevents the preview screen from showing
  setAudioChunks([]);        // Clear out the recorded data
  clearInterval(timerRef.current); // Clear your timer if you have one
  setRecordingTime(0);
};

  // 4. Send Audio Message
  const handleSendAudio = async () => {
    if (!audioBlob) return;
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64Audio = reader.result;
      const socket = socketRef.current;
      if (!socket) return;

      const clientMessageId = 'client-' + Date.now() + '-' + Math.random();
const optimisticMessage = {
  _id: clientMessageId,
  clientMessageId: clientMessageId,
  text: '',
  audio: base64Audio, // <-- Ensure this is included
  sender: user.displayName || user.email,
  senderUid: user.uid,
  avatar: user.photoURL,
  room: room,
  createdAt: new Date(),
  pending: true
};

      setMessages((prev) => [...prev, optimisticMessage]);
      setRecordedAudioUrl(null);
      setAudioBlob(null);

      socket.emit('send_message', {
        clientMessageId,
        text: '',
        audio: base64Audio,
        sender: user.displayName || user.email,
        senderUid: user.uid,
        avatar: user.photoURL,
        room: room,
      });
    };
  };

  const handleSendThreadReply = (e) => {
    e.preventDefault();
    const socket = socketRef.current;
    if (!threadInput.trim() || !socket || !activeThreadMessage) return;

    const replyData = {
      text: threadInput.trim(),
      sender: user.displayName || user.email,
      senderUid: user.uid,
      avatar: user.photoURL,
      room: room,
      parentId: activeThreadMessage._id,
      createdAt: new Date(),
    };

    socket.emit('send_message', replyData, (response) => {
      if (response?.success) {
        setThreadInput('');
      }
    });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveLightboxImage(null);
      }
    };

    if (activeLightboxImage) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeLightboxImage]);

  useEffect(() => {
    if (!activeThreadMessage) {
      setThreadMessages([]);
      return;
    }
    fetch(`${BACKEND_URL}/api/messages/thread?parentId=${activeThreadMessage._id}`)
      .then((res) => res.json())
      .then((data) => setThreadMessages(data))
      .catch((err) => console.error("Failed to load thread messages:", err));
  }, [activeThreadMessage]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (activeThreadMessage && message.parentId === activeThreadMessage._id) {
        setThreadMessages((prev) => [...prev, message]);
      }
    };

    socket.on('receive_message', handleNewMessage);
    return () => socket.off('receive_message', handleNewMessage);
  }, [activeThreadMessage]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/messages/search?room=${room}&query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Failed to search messages:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, room]);

  const displayedMessages = searchQuery.trim() ? searchResults : messages;

  const loadMoreMessages = async () => {
    if (isFetchingMore || !hasMorePages || messages.length === 0) return;
    
    setIsFetchingMore(true);
    try {
      const oldestMessageTime = messages[0].createdAt;
      const res = await fetch(`${BACKEND_URL}/api/messages?room=${room}&limit=30&before=${oldestMessageTime}`);
      const olderData = await res.json();

      if (olderData.length === 0) {
        setHasMorePages(false);
      } else {
        setMessages((prev) => [...olderData, ...prev]);
        if (olderData.length < 30) {
          setHasMorePages(false);
        }
      }
    } catch (err) {
      console.error('Failed to load older messages', err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleCloseLightbox = () => {
    setActiveLightboxImage(null);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    let newScale = scale + (e.deltaY < 0 ? zoomIntensity : -zoomIntensity);
    newScale = Math.min(Math.max(newScale, 1), 4);
    
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
    setScale(newScale);
  };

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  const mainChannelMessages = messages.filter((msg) => !msg.parentId);
  const filteredMessages = searchQuery.trim()
    ? mainChannelMessages.filter((msg) => msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : mainChannelMessages;

  useEffect(() => {
    if (!user || messages.length === 0) return;
    
    const unreadMessageIds = messages
      .filter((msg) => msg.senderUid !== user.uid && (!msg.readBy || !msg.readBy.includes(user.uid)))
      .map((msg) => msg._id);

    if (unreadMessageIds.length > 0 && socketRef.current) {
      socketRef.current.emit('mark_messages_read', {
        messageIds: unreadMessageIds,
        userId: user.uid,
        room
      });
    }
  }, [messages, user, room]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleReadUpdate = ({ messageIds, userId }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          messageIds.includes(msg._id)
            ? { ...msg, readBy: [...(msg.readBy || []), userId] }
            : msg
        )
      );
    };

    socket.on('messages_read_update', handleReadUpdate);
    return () => { socket.off('messages_read_update', handleReadUpdate); };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND_URL}/api/users`)
      .then((res) => res.json())
      .then((data) => setAllRegisteredUsers(data))
      .catch((err) => console.error("Failed to fetch registered users:", err));
  }, [user]);

  const handleOpenPrivateChat = (targetUser) => {
    const privateRoomId = [user.uid, targetUser.uid].sort().join('_');
    setRoom(privateRoomId);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => { roomRef.current = room; }, [room]);

  const playAlertSound = useCallback(() => {
    try {
      const audio = new Audio('/notification.wav');
      audio.volume = 1;
      audio.play();
    } catch (error) {
      console.warn("Audio system context blocked.", error);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const highlightText = useCallback((text, highlight) => {
    if (!highlight.trim()) return text;
    const escapedHighlight = highlight.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className={styles.searchTextHighlight}>{part}</mark> : part
    );
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let isCancelled = false;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    async function initSocket() {
      try {
        const token = await user.getIdToken();
        if (isCancelled) return;

        const socket = io(BACKEND_URL, { autoConnect: true, auth: { token } });
        socketRef.current = socket;

        // Force user mapping on the server immediately
        socket.emit("realRegisterUser", user.uid);

        // ==========================================
        // ADD WEBRTC LISTENERS HERE SO THEY BIND PROPERLY
        // ==========================================
        socket.on("incoming_call", ({ signal, from, name }) => {
          console.log("🚨 SUCCESS! Incoming call received from:", name);
          setCallerInfo({ name, from });
          setIncomingSignal(signal);
          setCallStatus("incoming");
        });

// Locate inside your App.jsx -> initSocket() hook
socket.on("call_accepted", async (signal) => {
  setCallStatus("connected");
  
  // STEP FIX: Commit the active stream reference explicitly to trigger a React render update
  if (localStreamRef.current) {
    setLocalStream(localStreamRef.current);
  }

  const pc = peerConnectionRef.current;
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(signal));
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding queued ice candidate:", err);
      }
    }
  }
});


        socket.on("ice_candidate", async (candidate) => {
          const pc = peerConnectionRef.current;
          if (pc) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error("Error adding received ice candidate:", err);
              }
            } else {
              iceCandidateQueueRef.current.push(candidate);
            }
          }
        });

        socket.on("call_ended", () => {
          endCallCleanup();
        });
        // ==========================================

        let fcmDeviceToken = null;
        try {
          if ('serviceWorker' in navigator) {
            const messaging = getMessaging();
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            await navigator.serviceWorker.ready;
            fcmDeviceToken = await getToken(messaging, {
              vapidKey: "BI2_PHDGRR7jW2ybN8Vyo_ozgB1TYjw5k9omVSDIsFMMaKUk8L6lInMVo63bXxe-19Rb7QQlLNPgpfnW_88_Q-A", 
              serviceWorkerRegistration: registration
            });
          }
        } catch (pushErr) {
          console.warn("FCM Token skipped:", pushErr);
        }
        
        socket.emit('user_connected', {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          avatar: user.photoURL,
          pushSubscription: fcmDeviceToken 
        });

        socket.on('active_users_list', (users) => {
          setActiveUsers(Array.from(new Map(users.map(u => [u.uid, u])).values()));
        });

        socket.on('message_updated', (updatedMsg) => {
          setMessages((prev) => prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg)));
        });

        socket.on('message_deleted', (deletedId) => {
          setMessages((prev) => prev.filter((msg) => msg._id !== deletedId));
        });
        
socket.on('receive_message', (message) => {
  // PRIVACY BOUNDARY SECURITY: Throw away messages intended for distinct conversation scopes
  if (message.room !== roomRef.current) return;
  if (message.parentId) return;

  setMessages((prev) => {
    if (message.clientMessageId) {
      const index = prev.findIndex(m => m.clientMessageId === message.clientMessageId);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = message;
        return updated;
      }
    }

    if (message.senderUid === user.uid) {
      const pendingIndex = prev.findIndex(m => m.pending && (m.text === message.text || (m.audio && message.audio)));
      if (pendingIndex !== -1) {
        const updated = [...prev];
        updated[pendingIndex] = message;
        return updated;
      }
    }

    return [...prev, message];
  });
});


        socket.on('display_typing', ({ userName, room: typingRoom }) => {
          if (typingRoom === roomRef.current) setTypingUser(userName);
        });

        socket.on('hide_typing', ({ room: typingRoom }) => {
          if (typingRoom === roomRef.current) setTypingUser(null);
        });
      } catch (err) {
        console.error("Socket init error:", err);
      }
    }

    initSocket();

    return () => {
      isCancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, playAlertSound]);

  useEffect(() => {
    if (!user) return;
    setRoomLoading(true);
    setTypingUser(null);
    setHasMorePages(true);

    setUnreadCounts((prev) => ({ ...prev, [room]: 0 }));

    const controller = new AbortController();
    fetch(`${BACKEND_URL}/api/messages?room=${room}&limit=30`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        setRoomLoading(false);
        setHasMorePages(data.length === 30);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error("Error loading chat history:", err);
          setRoomLoading(false);
        }
      });

    if (socketRef.current) {
      socketRef.current.emit('join_room', room);
    }

    return () => controller.abort();
  }, [room, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectRoom = (selectedRoom) => {
    setRoom(selectedRoom);
    setIsMobileMenuOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    const socket = socketRef.current;
    if (!socket) return;
    
    socket.emit('typing_start', { room, userName: user.displayName || user.email });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit('typing_stop', { room }), 1500);
  };

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { console.error("Login Failed:", error); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const socket = socketRef.current;
    if ((!newMessage.trim() && !selectedImage) || !socket || isSending) return;
    
    const clientMessageId = 'client-' + Date.now() + '-' + Math.random();
    const messageText = newMessage.trim();
    const messageImage = selectedImage;

    setNewMessage('');
    setSelectedImage(null);

    const optimisticMessage = {
      _id: clientMessageId,
      clientMessageId: clientMessageId,
      text: messageText || "\u200B",
      sender: user.displayName || user.email,
      senderUid: user.uid,
      image: messageImage || null,
      avatar: user.photoURL,
      room: room,
      createdAt: new Date(),
      pending: true
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    socket.emit('send_message', {
      clientMessageId,
      text: messageText || "\u200B",
      sender: user.displayName || user.email,
      senderUid: user.uid,
      image: messageImage || null,
      avatar: user.photoURL,
      room: room,
    });
  };

const handleEditMessage = (newText) => {
    const socket = socketRef.current;
    if (!newText.trim() || !socket || !editingMessageId) return;
    socket.emit('edit_message', { messageId: editingMessageId, text: newText, userId: user.uid, room });
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setSelectedImage(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        const reader = new FileReader();
        reader.onloadend = () => setSelectedImage(reader.result);
        reader.readAsDataURL(file);
      }
    }
  };
  // Determine if the current room is a direct message or a public channel
  if (loading) return <div className={styles.loader}><h3>Loading...</h3></div>;

  return (
    <div className={styles.container}>
      {!user ? (
        <LoginCard onLogin={handleGoogleLogin} />
      ) : (
        <div className={styles.chatWrapper}>
          <Header 
            user={user}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchInputRef={searchInputRef}
            handleSvgClick={() => searchInputRef.current?.focus()}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            room={room}
            isPrivateRoom={isPrivateRoom}
            headerTitle={activeHeaderTitle}
            headerAvatar={activeHeaderAvatar}
            activeHeaderUser={activeHeaderUser}
            isHeaderUserOnline={isHeaderUserOnline}
            formatLastSeen={formatLastSeen}
            startCall={startCall}
            activeUsers={activeUsers}
          />

          <div className={styles.mainContent}>
            <div 
              className={`${styles.backdrop} ${isMobileMenuOpen ? styles.backdropVisible : ''}`} 
              onClick={() => setIsMobileMenuOpen(false)} 
            />
            <Sidebar 
              roomsList={ROOMS_LIST}
              room={room}
              onSelectRoom={handleSelectRoom}
              onSelectPrivateChat={handleOpenPrivateChat}
              unreadCounts={unreadCounts}
              activeUsers={activeUsers}
              allUsers={allRegisteredUsers}
              currentUser={user}
              isMobileMenuOpen={isMobileMenuOpen}
              onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
              startCall={startCall}
            />
            <div className={styles.chatWindow} ref={feedRef}>
              <ChatFeed 
                messages={filteredMessages}
                user={user}
                searchQuery={searchQuery}
                roomLoading={roomLoading}
                room={room}
                selectedImage={selectedImage}
                isSendingImage={isSendingImage}
                setSelectedImage={setSelectedImage}
                editingMessageId={editingMessageId}
                setEditingMessageId={setEditingMessageId}
                editingText={editingText}
                setEditingText={setEditingText}
                handleEditMessage={handleEditMessage}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                setDeleteModalMessageId={setDeleteModalMessageId}
                highlightText={highlightText}
                messagesEndRef={messagesEndRef}
                setInfoModalMessage={setInfoModalMessage}
                loadMoreMessages={loadMoreMessages}
                hasMorePages={hasMorePages}
                isFetchingMore={isFetchingMore}
                setShowScrollBtn={setShowScrollBtn}
                setActiveThreadMessage={setActiveThreadMessage}
                setActiveLightboxImage={setActiveLightboxImage} 
              />
              <TypingIndicator typingUser={typingUser} />
              <ThreadView 
                activeThreadMessage={activeThreadMessage}
                setActiveThreadMessage={setActiveThreadMessage}
                threadMessages={threadMessages}
                user={user}
                threadInput={threadInput}
                setThreadInput={setThreadInput}
                handleSendThreadReply={handleSendThreadReply}
              />

              {showScrollBtn && (
                <button onClick={scrollToBottom} className={styles.scrollToBottomBtn} aria-label="Scroll to bottom">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M1.646 6.646a.5.5 0 0 1 .708 0L8 12.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                    <path fillRule="evenodd" d="M1.646 2.646a.5.5 0 0 1 .708 0L8 8.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                  </svg>
                </button>
              )}

              <ChatInputForm 
                newMessage={newMessage}
                handleInputChange={handleInputChange}
                handlePaste={handlePaste}
                handleSendMessage={handleSendMessage}
                roomLoading={roomLoading}
                isSendingImage={isSendingImage}
                fileInputRef={fileInputRef}
                isSending={isSending}
                handleImageSelect={handleImageSelect}
                isRecording={isRecording}
                startRecording={startRecording}
                stopRecording={stopRecording}
                cancelRecording={cancelRecording}
                recordedAudioUrl={recordedAudioUrl}
                setRecordedAudioUrl={setRecordedAudioUrl}
                recordingTime={recordingTime}
                handleSendAudio={handleSendAudio}
                setIsStudioOpen={setIsStudioOpen}
                setCaptureType={setCaptureType}
              />
            </div>
          </div>
        </div>
      )}

      {activeLightboxImage && (
        <div 
          className={styles.lightboxOverlay} 
          onClick={handleCloseLightbox}
          onWheel={handleWheel}
        >
          <button 
            className={styles.lightboxCloseBtn} 
            onClick={handleCloseLightbox}
            aria-label="Close lightbox"
          >
            ×
          </button>
          <div 
            className={styles.lightboxContentWrapper} 
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          >
            <img 
              src={activeLightboxImage} 
              alt="Enlarged view" 
              className={styles.lightboxImage} 
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
      {editingMessageId && (
        <EditMessageModal 
          isOpen={Boolean(editingMessageId)}
          initialText={editingText}
          onSave={handleEditMessage}
          onClose={() => {
            setEditingMessageId(null);
            setEditingText('');
          }}
        />
      )}
{infoModalMessage && (
  <InfoModal 
    message={infoModalMessage} 
    onClose={() => setInfoModalMessage(null)} 
  />
)}
      {deleteModalMessageId && (
        <DeleteModal 
          isDeleting={isDeleting}
          onCancel={() => setDeleteModalMessageId(null)}
          onDelete={() => {
            setIsDeleting(true);
            const socket = socketRef.current;
            if (socket) {
              socket.emit('delete_message', { messageId: deleteModalMessageId, userId: user.uid });
            }
            setTimeout(() => {
              setIsDeleting(false);
              setDeleteModalMessageId(null);
            }, 500);
          }}
        />
      )}

      {infoModalMessage && (
        <div className={styles.modalOverlay} onClick={() => setInfoModalMessage(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3>Message Info</h3>
            <p className={styles.modalSubtext}>Read by the following users:</p>

            <div className={styles.modalUserList}>
              {infoModalMessage.readBy && infoModalMessage.readBy.length > 0 ? (
                allRegisteredUsers
                  .filter((u) => infoModalMessage.readBy.includes(u.uid) && u.uid !== infoModalMessage.senderUid)
                  .map((u) => (
                    <div key={u.uid} className={styles.modalUserItem}>
                      <img src={u.avatar || 'https://placeholder.com'} alt="" className={styles.userAvatar} />
                      <span>{u.name}</span>
                    </div>
                  ))
              ) : (
                <p className={styles.noReadsText}>No one has read this message yet.</p>
              )}
            </div>
            <button 
              className={styles.modalCloseBtn} 
              onClick={() => setInfoModalMessage(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSettingsOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3>User Settings</h3>
            <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <img src={user?.photoURL} alt="" style={{ width: '60px', height: '60px', borderRadius: '50%' }} />
              <p style={{ fontWeight: 600, color: '#fff' }}>{user?.displayName}</p>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>{user?.email}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <button 
                className={styles.modalDeleteBtn} 
                onClick={() => {
                  setIsSettingsOpen(false);
                  signOut(auth);
                }}
              >
                Log Out
              </button>
              <button 
                className={styles.modalCancelBtn} 
                onClick={() => setIsSettingsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
<CallModal
  callStatus={callStatus}
  callerName={callerInfo.name}
  onAccept={acceptCall}
  onReject={handleHangup}
  localStream={localStream}
  remoteStream={remoteStream}
/>
 {/* Move it here, out of ChatInputForm! */}
      <ScreenCaptureModal 
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        onSaveScreenshot={(base64Data) => setSelectedImage(base64Data)}
        captureType={captureType}
      />
    </div>
  );
}