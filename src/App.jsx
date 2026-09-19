import { useState, useEffect, useRef } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { io } from 'socket.io-client';
import { auth, googleProvider } from './firebase';
import styles from './App.module.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState('general');
  const [roomLoading, setRoomLoading] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [deleteModalMessageId, setDeleteModalMessageId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({ general: 0, tech: 0, random: 0, gaming: 0 });
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const roomsList = ['general', 'tech', 'random', 'gaming'];
  const [openMenuId, setOpenMenuId] = useState(null);
  const [chatType, setChatType] = useState('channel'); 
  const [selectedUser, setSelectedUser] = useState(null); 
  const currentRoom = chatType === 'channel' 
    ? room 
    : getPrivateRoomId(user.uid, selectedUser?.uid);
  const roomRef = useRef(room);
  
  // Mobile UI States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const feedRef = useRef(null); 
  
  // Image Feature States
  const [selectedImage, setSelectedImage] = useState(null); 
  const fileInputRef = useRef(null);

  // Converts file uploads into usable Base64 text strings
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result); 
    };
    reader.readAsDataURL(file);
  };

  // Handle clipboard copy-paste events directly on the input field
  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImage(reader.result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFeedScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBtn(isScrolledUp);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  // Crucial: Intercept active horizontal swipes from the edge to block default page-back actions
  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    
    const diffX = touch.clientX - startX;
    const diffY = touch.clientY - startY;

    if (startX <= 40 && diffX > 0 && Math.abs(diffX) > Math.abs(diffY)) {
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    
    const diffX = touch.clientX - startX;
    const diffY = touch.clientY - startY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (!isMobileMenuOpen) {
        const edgeZone = 40; 
        const minSwipeDistance = 50; 
        
        if (startX <= edgeZone && diffX > minSwipeDistance) {
          setIsMobileMenuOpen(true);
        }
      }
      else if (isMobileMenuOpen) {
        const minSwipeDistance = 50;
        if (diffX < -minSwipeDistance) {
          setIsMobileMenuOpen(false);
        }
      }
    }
  };

  const handleSelectRoom = (selectedRoom) => {
    setRoom(selectedRoom);
    setIsMobileMenuOpen(false); 
  };
  
  useEffect(() => { roomRef.current = room; }, [room]);

  const unreadCountsRef = useRef(unreadCounts);
  useEffect(() => { unreadCountsRef.current = unreadCounts; }, [unreadCounts]);

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

    user.getIdToken().then((token) => {
      if (!isMounted) return;

      const newSocket = io(BACKEND_URL, { 
        autoConnect: true,
        auth: { token }
      });
      setSocket(newSocket);
      
      newSocket.emit('user_connected', {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        avatar: user.photoURL
      });

      newSocket.on('active_users_list', (users) => {
        const uniqueUsers = Array.from(new Map(users.map(u => [u.uid, u])).values());
        setActiveUsers(uniqueUsers);
      });

      newSocket.off('receive_message');
      newSocket.off('message_updated');
      newSocket.off('message_deleted');
      
      newSocket.on('message_updated', (updatedMsg) => {
        setMessages((prev) => 
          prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg))
        );
      });

      newSocket.on('message_deleted', (deletedId) => {
        setMessages((prev) => prev.filter((msg) => msg._id !== deletedId));
      });
      
      newSocket.on('receive_message', (message) => {
        const activeRoom = roomRef.current;
        if (message.room === activeRoom) {
          setMessages((prev) => [...prev, message]);
        } 
        if (message.room !== activeRoom && message.senderUid !== user.uid) {
          setUnreadCounts((prev) => {
            const nextCount = (prev[message.room] || 0) + 1;
            return { ...prev, [message.room]: nextCount };
          });
        }
      });

      newSocket.on('display_typing', ({ userName, room: typingRoom }) => {
        if (typingRoom === roomRef.current) {
          setTypingUser(userName);
        }
      });

      newSocket.on('hide_typing', ({ room: typingRoom }) => {
        if (typingRoom === roomRef.current) {
          setTypingUser(null);
        }
      });

    }).catch((err) => console.error("Socket auth token error:", err));

    return () => {
      isMounted = false;
      if (socket) socket.disconnect();
    };
  }, [user]);

  function getPrivateRoomId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
  }

  useEffect(() => {
    if (!user) return;
    setRoomLoading(true);
    setTypingUser(null);

    setUnreadCounts((prev) => ({ ...prev, [room]: 0 }));

    fetch(`${BACKEND_URL}/api/messages?room=${room}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        setRoomLoading(false);
      })
      .catch((err) => {
        console.error("Error loading chat history:", err);
        setRoomLoading(false);
      });

    if (socket) {
      socket.emit('join_room', room);
    }
  }, [room, socket, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);

    if (!socket) return;
    socket.emit('typing_start', { room, userName: user.displayName || user.email });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { room });
    }, 1500);
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Failed:", error);
    }
  };

 const handleSendMessage = async (e) => {
  e.preventDefault();
  
  // 1. Guard Rule: Block if BOTH text and image strings are totally non-existent
  if (!newMessage.trim() && !selectedImage) {
    console.log("⚠️ Blocked transmission: Message body is completely empty.");
    return;
  }
  
  if (!socket) return;

  // Stop typing tracker safely
  socket.emit('typing_stop', { room });

  // 2. Prepare payload cleanly
  const messageData = {
    // If text is blank or spaces, fallback to an empty string cleanly
    text: newMessage.trim() ? newMessage : "", 
    sender: user.displayName || user.email,
    senderUid: user.uid,
    image: selectedImage ? selectedImage : null, // Attaches the base64 string safely
    avatar: user.photoURL,
    room: room,
    createdAt: new Date(),
  };

  try {
    // 3. Emit the socket packet payload safely
    socket.emit('send_message', messageData);
    
    // 4. CRUCIAL FIX: ONLY wipe out inputs AFTER the web socket successfully fires
    setNewMessage('');
    setSelectedImage(null);
  } catch (error) {
    console.error("❌ Failed to push payload over WebSocket frame:", error);
  }
};


  if (loading) {
    return <div className={styles.loader}><h3>Loading...</h3></div>;
  }

  const currentRoomUsers = activeUsers;

  return (
    <div 
      className={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}    
    >
      {!user ? (
        <div className={styles.loginContainer}>
          <div className={styles.loginCard}>
            <h1 className={styles.title}>Public Chat</h1>
            <p className={styles.subtitle}>Real-time public chat with google auth</p>
            <button onClick={handleGoogleLogin} className={styles.googleBtn}>
              Continue with Google
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.chatWrapper}>
          <header className={styles.header}>
            <button 
              className={styles.hamburgerButton} 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
              </svg>  
            </button>
            <div className={styles.headerLeft}>
              <img src={user.photoURL} alt="Profile" className={styles.profileImg} />
              <div className={styles.headerUserInfo}>
                <span className={styles.headerUserName}>{user.displayName}</span>
                <span className={styles.liveIndicator}>● Live Node Link</span>
              </div>
            </div>
            <button onClick={() => signOut(auth)} className={styles.logoutBtn}>Log Out</button>
          </header>

          <div className={styles.mainContent}>
            <div 
              className={`${styles.backdrop} ${isMobileMenuOpen ? styles.backdropVisible : ''}`} 
              onClick={() => setIsMobileMenuOpen(false)} 
            />

            <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
              <div className={styles.sidebarSection}>
                <h4 className={styles.sidebarTitle}>Channels</h4>
                <div className={styles.roomList}>
                  {roomsList.map((channel) => (
                    <button
                      key={channel}
                      onClick={() => handleSelectRoom(channel)}
                      className={`${styles.roomBtn} ${room === channel ? styles.roomBtnActive : ''}`}
                    >
                      <span># {channel}</span>
                      {unreadCounts[channel] > 0 && (
                        <span className={styles.unreadBadge}>{unreadCounts[channel]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.sidebarSection}>
                <h4 className={styles.sidebarTitle}>Online users</h4>
                <div className={styles.userList}>
                  {currentRoomUsers.map((u) => (
                    <div key={u.uid} className={styles.userItem}>
                      <img src={u.avatar || 'https://placeholder.com'} alt="" className={styles.userAvatar} />
                      <span className={styles.userName}>{u.name}</span>
                      <div className={styles.statusDot} />
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <div className={styles.chatWindow}>
              <div className={styles.messageFeed} ref={feedRef} onScroll={handleFeedScroll}>
                {roomLoading ? (
                  <div className={styles.roomLoaderContainer}>
                    <div className={styles.spinner} />
                    <p className={styles.modalDescription} style={{ marginTop: '10px' }}>Switching to #{room}...</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, index) => {
                      const isMe = msg.senderUid === user.uid;
                      const timeString = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      const isMenuOpen = openMenuId === msg._id;

                      return (
                        <div key={msg._id || index} className={styles.messageRow} style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          <div className={styles.messageContentWrapper} style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                            {!isMe && <img src={msg.avatar || 'https://placeholder.com'} alt="" className={styles.messageAvatar} />}
                            <div>
                              {!isMe && <small className={styles.messageSenderName}>{msg.sender}</small>}
                              <div className={`${styles.messageBubbleBase} ${isMe ? styles.messageBubbleMe : styles.messageBubbleOther}`}>
                                <span className={styles.messageText}>
                                  {msg.text}
                                  {msg.image && (
                                    <img 
                                      src={msg.image} 
                                      alt="Sent asset" 
                                      className={styles.chatImage} 
                                      onClick={() => window.open(msg.image, '_blank')} 
                                    />
                                  )}
                                </span>
                                <span className={isMe ? styles.messageTimestampMe : styles.messageTimestampOther}>{timeString}</span>

                                {isMe && msg._id && (
                                  <div className={`${styles.messageActionTrigger} ${isMenuOpen ? styles.forceVisible : ''}`}>
                                    <button 
                                      onClick={() => setOpenMenuId(isMenuOpen ? null : msg._id)} 
                                      className={styles.optionsButton}
                                      title="Message options"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                        <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                                      </svg>
                                    </button>

                                    {isMenuOpen && (
                                      <div className={styles.dropdownMenu}>
                                        <button 
                                          onClick={() => {
                                            setOpenMenuId(null);
                                            setDeleteModalMessageId(msg._id);
                                          }}
                                          className={styles.dropdownItemDelete}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {typingUser && (
                      <div className={styles.typingIndicatorRow}>
                        <div className={styles.typingBubble}>
                          <span className={styles.dot}></span>
                          <span className={styles.dot}></span>
                          <span className={styles.dot}></span>
                        </div>
                        <span className={styles.typingText}>{typingUser} is typing...</span>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {showScrollBtn && (
                <button onClick={scrollToBottom} className={styles.scrollToBottomBtn} aria-label="Scroll to bottom">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                  </svg>
                </button>
              )}

              <div style={{ position: 'relative', width: '100%' }}>
                {selectedImage && (
                  <div className={styles.previewContainer}>
                    <img src={selectedImage} alt="Upload preview" className={styles.previewImage} />
                    <button type="button" onClick={() => setSelectedImage(null)} className={styles.removePreviewBtn}>×</button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className={styles.chatForm}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleImageSelect} 
                    style={{ display: 'none' }} 
                  />
                  
                  <button type="button" onClick={() => fileInputRef.current.click()} className={styles.logoutBtn} style={{padding: '8px 12px', borderColor: '#374151', color: '#9ca3af', marginRight: '-4px'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-paperclip" viewBox="0 0 16 16">
                      <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/>
                    </svg>
                  </button>

                  <input 
                    type="text" 
                    value={newMessage} 
                    onChange={handleInputChange} 
                    onPaste={handlePaste}
                    placeholder={roomLoading ? "Loading room..." : "Type a message..."}
                    disabled={roomLoading}
                    className={styles.chatInput} 
                  />
                  
                  <button type="submit" disabled={roomLoading} className={styles.sendBtn}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z"/>
                    </svg>
                    <span className={styles.btnText} style={{marginLeft: '6px'}}>Send</span>
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalMessageId && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Delete message?</h3>
            <p className={styles.modalDescription}>This message will be permanently deleted.</p>
            
            {isDeleting ? (
              <div className={styles.modalLoadingWrapper}>
                <div className={styles.spinner} />
                <span>Deleting...</span>
              </div>
            ) : (
              <div className={styles.modalActions}>
                <button onClick={() => setDeleteModalMessageId(null)} className={styles.modalCancelBtn}>
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsDeleting(true);
                    if (socket) {
                      socket.emit('delete_message', { messageId: deleteModalMessageId, userId: user.uid });
                    }
                    setTimeout(() => {
                      setIsDeleting(false);
                      setDeleteModalMessageId(null);
                    }, 500);
                  }}
                  className={styles.modalDeleteBtn}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}