// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('https://chat-app-backend-1yfa.onrender.com');

function App() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [messageList, setMessageList] = useState([]);

  useEffect(() => {
    // 1. Load chat history stored in MongoDB
    socket.on('load_history', (history) => {
      setMessageList(history);
    });

    // 2. Listen for real-time incoming messages
    socket.on('receive_message', (data) => {
      setMessageList((prev) => [...prev, data]);
    });

    return () => {
      socket.off('load_history');
      socket.off('receive_message');
    };
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      const messageData = {
        user: username,
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      socket.emit('send_message', messageData);
      setMessage('');
    }
  };

  if (!isLoggedIn) {
    return (
      <div style={styles.container}>
        <h2>Enter Chat Room</h2>
        <input
          type="text"
          placeholder="Your name..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={styles.input}
        />
        <button onClick={() => username && setIsLoggedIn(true)} style={styles.button}>
          Join Chat
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>Live Chat (Logged in as: {username})</h2>
      <div style={styles.chatBox}>
        {messageList.map((msg, index) => (
          <div key={index} style={styles.messageRow}>
            <strong>{msg.user}: </strong> {msg.text} 
            <span style={styles.time}>{msg.time}</span>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} style={styles.form}>
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Send</button>
      </form>
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '500px', margin: '40px auto', fontFamily: 'sans-serif' },
  input: { padding: '10px', width: '70%', marginRight: '10px', fontSize: '16px' },
  button: { padding: '10px 15px', fontSize: '16px', cursor: 'pointer' },
  chatBox: { border: '1px solid #ccc', height: '300px', overflowY: 'auto', padding: '10px', marginBottom: '10px' },
  messageRow: { marginBottom: '8px' },
  time: { fontSize: '11px', color: '#888', marginLeft: '8px' }
};

export default App;