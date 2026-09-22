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

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://chat-app-backend-1yfa.onrender.com';
const ROOMS_LIST = ['general', 'tech', 'random', 'gaming'];

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

  const roomRef = useRef(room);
  const socketRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const feedRef = useRef(null); 

const fetchMessagesForRoom = async (targetRoom) => {
  console.log(`[CLIENT DEBUG] fetchMessagesForRoom triggered for room: ${targetRoom}`);
  try {
    const url = `${BACKEND_URL}/api/messages?room=${targetRoom}&limit=30`;
    console.log(`[CLIENT DEBUG] Fetching URL: ${url}`);
    
    const res = await fetch(url);
    console.log(`[CLIENT DEBUG] Response status: ${res.status} ${res.statusText}`);
    
    const data = await res.json();
    console.log(`[CLIENT DEBUG] Received ${data.length} messages for room: ${targetRoom}`, data);
    
    setMessages(data);
    setHasMorePages(data.length === 30);
    console.log(`[CLIENT DEBUG] State updated. hasMorePages set to: ${data.length === 30}`);
  } catch (err) {
    console.error('[CLIENT ERROR] Failed to load messages in fetchMessagesForRoom:', err);
  }
};

const loadMoreMessages = async () => {
  console.log('[CLIENT DEBUG] loadMoreMessages triggered by scroll/Virtuoso');
  console.log('[CLIENT DEBUG] Current flags -> isFetchingMore:', isFetchingMore, '| hasMorePages:', hasMorePages, '| messages.length:', messages.length);

  if (isFetchingMore || !hasMorePages || messages.length === 0) {
    console.log('[CLIENT DEBUG] loadMoreMessages aborted early due to guard conditions.');
    return;
  }
  
  setIsFetchingMore(true);
  try {
    const oldestMessageTime = messages[0].createdAt;
    const url = `${BACKEND_URL}/api/messages?room=${room}&limit=30&before=${oldestMessageTime}`;
    console.log(`[CLIENT DEBUG] Fetching older messages URL: ${url}`);
    
    const res = await fetch(url);
    console.log(`[CLIENT DEBUG] Older messages response status: ${res.status}`);
    
    const olderData = await res.json();
    console.log(`[CLIENT DEBUG] Received ${olderData.length} older messages`, olderData);

    if (olderData.length === 0) {
      console.log('[CLIENT DEBUG] No more older messages available. Setting hasMorePages to false.');
      setHasMorePages(false);
    } else {
      setMessages((prev) => {
        console.log(`[CLIENT DEBUG] Prepending ${olderData.length} older messages to existing ${prev.length} messages.`);
        return [...olderData, ...prev];
      });
    }
  } catch (err) {
    console.error('[CLIENT ERROR] Failed to load older messages:', err);
  } finally {
    setIsFetchingMore(false);
    console.log('[CLIENT DEBUG] loadMoreMessages finished. isFetchingMore reset to false.');
  }
};
// Inside your socket real-time listener for incoming messages:

  // 1. Create a filtered list based on the search query
const filteredMessages = searchQuery.trim()
  ? messages.filter((msg) => msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
  : messages;
// Automatically mark incoming messages as read if they belong to the current room
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

  // Listen for read receipt updates from other users in real time
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
  // Sort UIDs consistently so both users generate the identical room identifier string
  const privateRoomId = [user.uid, targetUser.uid].sort().join('_');

  setRoom(privateRoomId);         // Triggers your existing useEffect to join room & fetch messages
  setIsMobileMenuOpen(false);     // Close mobile drawer if open
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Centralized Socket Connection & Event Registry with Debug Logs
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    user.getIdToken().then(async (token) => {
      if (!isMounted) return;
      
      const socket = io(BACKEND_URL, { autoConnect: true, auth: { token } });
      socketRef.current = socket;

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
      
      // 🌟 DEBUG STEP: Log every incoming message packet
      socket.on('receive_message', (message) => {
        const activeRoom = roomRef.current.toLowerCase(); // 🌟 Ensure activeRoom is lowercased
        console.log("📥 [DEBUG] receive_message fired:", message);
        
        const targetRoom = (message.room || activeRoom).toLowerCase();
        console.log("📥 [DEBUG] targetRoom:", targetRoom, "| activeRoom:", activeRoom);
        if (msg.room === room) {
          setMessages((prev) => [...prev, msg]); // Appends new live message at bottom
        }
        if (targetRoom === activeRoom) {
          console.log("✅ [DEBUG] Message belongs to ACTIVE room. Appending to feed.");
          setMessages((prev) => [...prev, message]);
          if (message.senderUid !== user.uid) playAlertSound();
        } else if (message.senderUid !== user.uid) {
          console.log("🔔 [DEBUG] Message belongs to DIFFERENT room. Incrementing unread count for:", targetRoom);
          setUnreadCounts((prev) => {
            const updated = { ...prev, [targetRoom]: (prev[targetRoom] || 0) + 1 };
            return updated;
          });
        } else {
          console.log("ℹ️ [DEBUG] Message was sent by current user in another room. Ignored.");
        }
      });

      socket.on('display_typing', ({ userName, room: typingRoom }) => {
        if (typingRoom === roomRef.current) setTypingUser(userName);
      });

      socket.on('hide_typing', ({ room: typingRoom }) => {
        if (typingRoom === roomRef.current) setTypingUser(null);
      });
    });

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, playAlertSound]);

  // Handle Room Switching and Resetting Unread Counts with Debug Logs
useEffect(() => {
  if (!user) return;
  console.log("🔄 [DEBUG] Switching room to:", room);
  setRoomLoading(true);
  setTypingUser(null);

  setUnreadCounts((prev) => {
    const updated = { ...prev, [room]: 0 };
    return updated;
  });

  const controller = new AbortController();
  // When messages are loaded or viewed
  // Fetch only the latest 30 messages for fast initial load
  fetch(`${BACKEND_URL}/api/messages?room=${room}`, { signal: controller.signal })
    .then((res) => res.json())
    .then((data) => {
      setMessages(data);
      setRoomLoading(false);
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

  const autoScrollRef = useEffect(() => {
    if (!searchQuery.trim()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUser, searchQuery]);

const handleFeedScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 300);

  // If user scrolls to the top of the container and there are messages to look back on
};

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
    if ((!newMessage.trim() && !selectedImage) || !socket || isSendingImage) return;
    
    if (selectedImage) setIsSendingImage(true);
    socket.emit('typing_stop', { room });

    const messageData = {
      text: newMessage.trim() ? newMessage : "\u200B", 
      sender: user.displayName || user.email,
      senderUid: user.uid,
      image: selectedImage || null,
      avatar: user.photoURL,
      room: room,
      createdAt: new Date(),
    };

    socket.emit('send_message', messageData, (response) => {
      if (response?.success) {
        setNewMessage('');
        setSelectedImage(null);
      } else {
        alert("Failed to send message: " + (response?.error || "Unknown"));
      }
      setIsSendingImage(false);
    });
  };

  const handleEditMessage = (msgId) => {
    const socket = socketRef.current;
    if (!editingText.trim() || !socket) return;
    socket.emit('edit_message', { messageId: msgId, text: editingText, userId: user.uid, room });
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
            />

            <div className={styles.chatWindow} ref={feedRef} onScroll={handleFeedScroll}>
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
              />
              <TypingIndicator typingUser={typingUser} />

              {showScrollBtn && (
                <button onClick={scrollToBottom} className={styles.scrollToBottomBtn} aria-label="Scroll to bottom">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M1.646 6.646a.5.5 0 0 1 .708 0L8 12.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0_1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
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
                handleImageSelect={handleImageSelect}
              />
            </div>
          </div>
        </div>
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
    </div>
  );
}