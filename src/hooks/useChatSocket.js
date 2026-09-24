// src/hooks/useChatSocket.js
import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useChatSocket(serverUrl, authToken) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    const socketInstance = io(serverUrl, {
      auth: { token: authToken },
    });

    setSocket(socketInstance);

    socketInstance.on('message:receive', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socketInstance.on('users:online', (users) => {
      setOnlineUsers(users);
    });

    socketInstance.on('typing:update', ({ userId, isTyping }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [serverUrl, authToken]);

  const sendMessage = useCallback((content, channelId) => {
    if (socket) {
      socket.emit('message:send', { content, channelId });
    }
  }, [socket]);

  const sendTypingStatus = useCallback((isTyping, channelId) => {
    if (socket) {
      socket.emit('typing:update', { isTyping, channelId });
    }
  }, [socket]);

  return {
    socket,
    messages,
    onlineUsers,
    typingUsers,
    sendMessage,
    sendTypingStatus,
  };
}