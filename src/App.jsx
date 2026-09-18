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
  
  // 🌟 New features state
  const [typingUser, setTypingUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({ general: 0, tech: 0, random: 0, gaming: 0 });
  
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  const roomsList = ['general', 'tech', 'random', 'gaming'];

  // 🌟 Add this ref to track the live room state inside socket listeners
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Establish socket connection with token authentication
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
        avatar: user.photoURL
      });

      newSocket.on('active_users_list', (users) => {
        const uniqueUsers = Array.from(new Map(users.map(u => [u.uid, u])).values());
        setActiveUsers(uniqueUsers);
      });

      newSocket.on('receive_message', (message) => {
        // If message belongs to current room, push to feed
        setMessages((prev) => {
          if (message.room === room) {
            return [...prev, message];
          }
          return prev;
        });

        // If message is for a background room, increment unread badge counter
        if (message.room !== room && message.senderUid !== user.uid) {
          setUnreadCounts((prev) => ({
            ...prev,
            [message.room]: (prev[message.room] || 0) + 1
          }));
        }
      });

      newSocket.on('display_typing', ({ userName, room: typingRoom }) => {
        if (typingRoom === room) {
          setTypingUser(userName);
        }
      });

      newSocket.on('hide_typing', ({ room: typingRoom }) => {
        if (typingRoom === room) {
          setTypingUser(null);
        }
      });

    }).catch((err) => console.error("Socket auth token error:", err));

    return () => {
      isMounted = false;
      if (socket) socket.disconnect();
    };
  }, [user]);

  // Handle room changes, history loading, and clearing unread badges for active room
  useEffect(() => {
    if (!user || !socket) return;

    setRoomLoading(true);
    setTypingUser(null);

    // Clear unread badge for the newly selected room
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

    socket.emit('join_room', room);
  }, [room, socket, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Handle input changes with typing indicator emission
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
    if (!newMessage.trim() || !socket) return;

    socket.emit('typing_stop', { room });

    const messageData = {
      text: newMessage,
      sender: user.displayName || user.email,
      senderUid: user.uid,
      avatar: user.photoURL,
      room: room,
      createdAt: new Date(),
    };

    socket.emit('send_message', messageData);
    setNewMessage('');
  };

  if (loading) {
    return <div className={styles.loader}><h3>Loading...</h3></div>;
  }

  // Filter active users currently in the selected room
  const currentRoomUsers = activeUsers.filter(u => u.room === room);

  return (
    <div className={styles.container}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={user.photoURL} alt="Profile" className={styles.profileImg} />
              <div>
                <strong style={{ display: 'block', color: '#fff' }}>{user.displayName}</strong>
                <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>● Live Node Link</span>
              </div>
            </div>
            <button onClick={() => signOut(auth)} className={styles.logoutBtn}>Log Out</button>
          </header>

          <div className={styles.mainContent}>
            <aside className={styles.sidebar}>
              {/* Room Selection with Unread Badges */}
              <div className={styles.sidebarSection}>
                <h4 className={styles.sidebarTitle}>Channels</h4>
                <div className={styles.roomList}>
                  {roomsList.map((channel) => (
                    <button
                      key={channel}
                      onClick={() => setRoom(channel)}
                      className={`${styles.roomBtn} ${room === channel ? styles.roomBtnActive : ''}`}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span># {channel}</span>
                      {unreadCounts[channel] > 0 && (
                        <span className={styles.unreadBadge}>{unreadCounts[channel]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.sidebarDivider} />

              {/* Online Users in Current Room */}
              <div className={styles.sidebarSection}>
                <h4 className={styles.sidebarTitle}>Online in #{room} ({currentRoomUsers.length})</h4>
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
              <div className={styles.messageFeed}>
                {roomLoading ? (
                  <div className={styles.roomLoaderContainer}>
                    <div className={styles.spinner} />
                    <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '10px' }}>Switching to #{room}...</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, index) => {
                      const isMe = msg.senderUid === user.uid;
                      const timeString = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                      return (
                        <div key={msg._id || index} className={styles.messageRow} style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          <div className={styles.messageContentWrapper} style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                            {!isMe && <img src={msg.avatar || 'https://placeholder.com'} alt="" className={styles.messageAvatar} />}
                            <div>
                              {!isMe && <small className={styles.messageSenderName}>{msg.sender}</small>}
                              <div className={`${styles.messageBubbleBase} ${isMe ? styles.messageBubbleMe : styles.messageBubbleOther}`}>
                                <span className={styles.messageText}>{msg.text}</span>
                                <span className={isMe ? styles.messageTimestampMe : styles.messageTimestampOther}>{timeString}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* 🌟 WhatsApp Style Typing Bubble Animation */}
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

              <form onSubmit={handleSendMessage} className={styles.chatForm}>
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={handleInputChange} 
                  placeholder={roomLoading ? "Loading room..." : "Type a message..."}
                  disabled={roomLoading}
                  className={styles.chatInput} 
                />
                <button type="submit" disabled={roomLoading} className={styles.sendBtn}>Send</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}