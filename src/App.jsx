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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    fetch(`${BACKEND_URL}/api/messages`)
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error("Error loading chat history:", err));

    const newSocket = io(BACKEND_URL, { autoConnect: true });
    setSocket(newSocket);

    newSocket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

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

    socket.emit('send_message', messageData);
    setNewMessage('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', background: '#0a0e17', color: '#fff' }}>
        <h3>Loading dark workspace... 🌙</h3>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#0a0e17', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, color: '#e2e8f0' }}>
      {!user ? (
        // Premium Dark Login Panel
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px' }}>
          <div style={{ background: '#111827', padding: '40px', borderRadius: '16px', border: '1px solid #1f2937', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
            <h1 style={{ color: '#fff', marginBottom: '10px', fontSize: '32px' }}>⚡ DarkChat</h1>
            <p style={{ color: '#9ca3af', marginBottom: '30px' }}>Experience blazing-fast real-time streams.</p>
            <button onClick={handleGoogleLogin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '14px', fontSize: '16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
              Sign in with Google
            </button>
          </div>
        </div>
      ) : (
        // Laptop & Mobile High-Fidelity UI Frame
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '1000px', width: '100%', margin: '0 auto', background: '#111827', borderLeft: '1px solid #1f2937', borderRight: '1px solid #1f2937' }}>
          
          {/* Dark Header */}
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: '#111827', borderBottom: '1px solid #1f2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={user.photoURL} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #2563eb' }} />
              <div>
                <strong style={{ display: 'block', color: '#fff' }}>{user.displayName}</strong>
                <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>● Live Node Link</span>
              </div>
            </div>
            <button onClick={() => signOut(auth)} style={{ padding: '6px 14px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: '0.2s' }}>
              Log Out
            </button>
          </header>

          {/* Dark Message Feed Panel */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#0f172a', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {messages.map((msg, index) => {
              const isMe = msg.senderUid === user.uid;
              return (
                <div key={msg._id || index} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '10px', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '75%' }}>
                    {!isMe && <img src={msg.avatar || 'https://placeholder.com'} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', marginTop: '2px' }} />}
                    <div>
                      {!isMe && <small style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '4px', marginLeft: '4px' }}>{msg.sender}</small>}
                      <div style={{ background: isMe ? '#2563eb' : '#1e293b', color: '#fff', padding: '12px 16px', borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)', wordBreak: 'break-word', fontSize: '15px', lineHeight: '1.5' }}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Bar */}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: '15px', background: '#111827', borderTop: '1px solid #1f2937', gap: '12px' }}>
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '14px 20px', borderRadius: '30px', border: '1px solid #374151', fontSize: '15px', outline: 'none', background: '#1f2937', color: '#fff' }} />
            <button type="submit" style={{ padding: '14px 28px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '30px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
              Send
            </button>
          </form>

        </div>
      )}
    </div>
  );
}
