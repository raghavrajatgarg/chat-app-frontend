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
  
  // 🌟 Added room state here
  const [room, setRoom] = useState('general');
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

 // Establish the socket connection once the user and their token are ready
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    user.getIdToken().then((token) => {
      if (!isMounted) return;

      const newSocket = io(BACKEND_URL, { 
        autoConnect: true,
        auth: { token } // Passes the Firebase token to satisfy server.js io.use()
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
        setMessages((prev) => [...prev, message]);
      });
    }).catch((err) => {
      console.error("Token fetch error for socket:", err);
    });

    return () => {
      isMounted = false;
      if (socket) socket.disconnect();
    };
  }, [user]);
  // 2. Fetch history and tell socket to join the room whenever the 'room' state changes
 // Add a new state for room loading at the top of your component alongside others:
  const [roomLoading, setRoomLoading] = useState(false);

  // Update your room-switching useEffect:
  useEffect(() => {
    if (!user || !socket) return;

    setRoomLoading(true); // 🌟 Turn on loading animation when room changes

    // Fetch messages specific to this room
    fetch(`${BACKEND_URL}/api/messages?room=${room}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data);
        setRoomLoading(false); // 🌟 Turn off loading when data arrives
      })
      .catch((err) => {
        console.error("Error loading chat history:", err);
        setRoomLoading(false);
      });

    // Tell the existing socket connection to switch rooms
    socket.emit('join_room', room);
  }, [room, socket, user]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    const messageData = {
      text: newMessage,
      sender: user.displayName || user.email,
      senderUid: user.uid,
      avatar: user.photoURL,
      room: room, // Attach current room to the payload
      createdAt: new Date(),
    };

    socket.emit('send_message', messageData);
    setNewMessage('');
  };

  if (loading) {
    return (
      <div className={styles.loader}>
        <h3>Loading...</h3>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!user ? (
        <div className={styles.loginContainer}>
          <div className={styles.loginCard}>
            <h1 className={styles.title}>Public Chat</h1>
            <p className={styles.subtitle}>Real-time public chat with google auth</p>
            
            <button onClick={handleGoogleLogin} className={styles.googleBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ display: 'block' }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
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
            <button onClick={() => signOut(auth)} className={styles.logoutBtn}>
              Log Out
            </button>
          </header>

          <div className={styles.mainContent}>
           <aside className={styles.sidebar}>
              {/* Top Half: Online Users */}
              <div className={styles.sidebarSection}>
                <h4 className={styles.sidebarTitle}>Online Users ({activeUsers.length})</h4>
                <div className={styles.userList}>
                  {activeUsers.map((u) => (
                    <div key={u.uid} className={styles.userItem}>
                      <img src={u.avatar || 'https://placeholder.com'} alt="" className={styles.userAvatar} />
                      <span className={styles.userName}>{u.name}</span>
                      <div className={styles.statusDot} />
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.sidebarDivider} />

              {/* Bottom Half: Room Selection */}
              <div className={styles.sidebarSection}>
                <h4 className={styles.sidebarTitle}>Channels</h4>
                <div className={styles.roomList}>
                  {['general', 'tech', 'random', 'gaming'].map((channel) => (
                    <button
                      key={channel}
                      onClick={() => setRoom(channel)}
                      className={`${styles.roomBtn} ${room === channel ? styles.roomBtnActive : ''}`}
                    >
                      # {channel}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div className={styles.chatWindow}>
              <div className={styles.messageFeed}>
                {roomLoading ? (
                  <div className={styles.roomLoaderContainer}>
                    <div className={styles.spinner} />
                    <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '10px' }}>
                      Switching to #{room}...
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
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
                              <span className={isMe ? styles.messageTimestampMe : styles.messageTimestampOther}>
                                {timeString}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className={styles.chatForm}>
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                  placeholder={roomLoading ? "Loading room..." : "Type a message..."}
                  disabled={roomLoading} // 🌟 Disable typing while switching rooms
                  className={styles.chatInput} 
                />
                <button type="submit" disabled={roomLoading} className={styles.sendBtn}>
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}