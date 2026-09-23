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
import ThreadView from './components/ThreadView'; // Adjust path if necessary

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
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadInput, setThreadInput] = useState('');

  const roomRef = useRef(room);
  const socketRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const feedRef = useRef(null); 

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
  if (!activeThreadMessage) {
    setThreadMessages([]);
    return;
  }
  fetch(`${BACKEND_URL}/api/messages/thread?parentId=${activeThreadMessage._id}`)
    .then((res) => res.json())
    .then((data) => setThreadMessages(data))
    .catch((err) => console.error("Failed to load thread messages:", err));
}, [activeThreadMessage]);

// Listen for incoming live thread replies via socket
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
// Debounced server-side search effect
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
  }, 400); // 400ms debounce

  return () => clearTimeout(timer);
}, [searchQuery, room]);

// Use searchResults when searching, otherwise use regular messages
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

// Filter out thread replies globally so they NEVER show up in the main feed
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
      
      socket.on('receive_message', (message) => {
        if (message.parentId) return;
        const activeRoom = roomRef.current.toLowerCase();
        const targetRoom = (message.room || activeRoom).toLowerCase();
        
        if (targetRoom === activeRoom) {
          setMessages((prev) => [...prev, message]);
          if (message.senderUid !== user.uid) playAlertSound();
        } else if (message.senderUid !== user.uid) {
          setUnreadCounts((prev) => ({
            ...prev,
            [targetRoom]: (prev[targetRoom] || 0) + 1
          }));
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-double-down" viewBox="0 0 16 16">
                    <path fill-rule="evenodd" d="M1.646 6.646a.5.5 0 0 1 .708 0L8 12.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                    <path fill-rule="evenodd" d="M1.646 2.646a.5.5 0 0 1 .708 0L8 8.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
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