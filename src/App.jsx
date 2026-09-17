import { useState, useEffect, useRef } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { io } from 'socket.io-client';
import { auth, googleProvider } from './firebase';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);

  // 1. Manage Firebase Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Manage Socket Connection & Initial Message Fetching
  useEffect(() => {
    if (!user) return;

    // Fetch message history from MongoDB Atlas on load
    fetch(`${BACKEND_URL}/api/messages`)
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error("Error loading chat history:", err));

    // Connect to the live Socket.io instance
    const newSocket = io(BACKEND_URL, { autoConnect: true });
    setSocket(newSocket);

    // Listen for incoming live chat broadcasts
    newSocket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // 3. Keep Chat Scrolled to Bottom automatically
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
      createdAt: new Date(),
    };

    // Emit via WebSockets—the backend handles saving to Mongo & broadcasting
    socket.emit('send_message', messageData);
    setNewMessage('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', background: '#f5f7fb' }}>
        <h3>Loading your workspace... 😊</h3>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#f5f7fb', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0 }}>
      {!user ? (
        // Elegant Login Screen
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px' }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
            <h1 style={{ color: '#333', marginBottom: '10px' }}>💬 LiveChat</h1>
            <p style={{ color: '#666', marginBottom: '30px' }}>Join the real-time stream instantly.</p>
            <button onClick={handleGoogleLogin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px', fontSize: '16px', background: '#4285F4', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
              Sign in with Google
            </button>
          </div>
        </div>
      ) : (
        // Mobile & Laptop Responsive Chat UI Container
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '1000px', width: '100%', margin: '0 auto', background: '#fff', boxShadow: '0 0 20px rgba(0,0,0,0.05)' }}>
          
          {/* Header Bar */}
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: '#fff', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={user.photoURL} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div>
                <strong style={{ display: 'block', color: '#333' }}>{user.displayName}</strong>
                <span style={{ fontSize: '12px', color: '#4caf50' }}>● Connected Live</span>
              </div>
            </div>
            <button onClick={() => signOut(auth)} style={{ padding: '6px 12px', background: 'transparent', color: '#ff4d4d', border: '1px solid #ff4d4d', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              Log Out
            </button>
          </header>

          {/* Active Messages Display Screen */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, index) => {
              const isMe = msg.senderUid === user.uid;
              return (
                <div key={msg._index || index} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '75%' }}>
                    {!isMe && <img src={msg.avatar || 'https://placeholder.com'} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', marginTop: '4px' }} />}
                    <div>
                      {!isMe && <small style={{ display: 'block', color: '#777', fontSize: '11px', marginBottom: '2px', marginLeft: '4px' }}>{msg.sender}</small>}
                      <div style={{ background: isMe ? '#007bff' : '#fff', color: isMe ? '#fff' : '#333', padding: '10px 14px', borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', wordBreak: 'break-word', fontSize: '15px', lineHeight: '1.4' }}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Interface Footer */}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: '15px', background: '#fff', borderTop: '1px solid #eee', gap: '10px' }}>
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message here..." style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid #ddd', fontSize: '15px', outline: 'none', background: '#f8f9fa' }} />
            <button type="submit" style={{ padding: '12px 24px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '24px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
              Send
            </button>
          </form>

        </div>
      )}
    </div>
  );
}
