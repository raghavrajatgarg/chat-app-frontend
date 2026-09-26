import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { getMessaging, getToken } from 'firebase/messaging';
import { io } from 'socket.io-client';
import { auth, googleProvider } from '../firebase';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://chat-app-backend-1yfa.onrender.com';
const ROOMS_LIST = ['general', 'tech', 'random', 'gaming'];

export default function useChatController({ callControllerRef, providedSocketRef }) {
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
  const isSendingImage = false;
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allRegisteredUsers, setAllRegisteredUsers] = useState([]);
  const [sendError, setSendError] = useState('');
  const [infoModalMessage, setInfoModalMessage] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [activeThreadMessage, setActiveThreadMessage] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadInput, setThreadInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const internalSocketRef = useRef(null);
  const socketRef = providedSocketRef || internalSocketRef;
  const roomRef = useRef(room);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const activeThreadMessageRef = useRef(null);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    const isUnverifiedPasswordUser = nextUser?.providerData.some((provider) => provider.providerId === 'password') && !nextUser.emailVerified;
    setUser(isUnverifiedPasswordUser ? null : nextUser);
    setLoading(false);
  }), []);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { activeThreadMessageRef.current = activeThreadMessage; }, [activeThreadMessage]);

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    if (!user) throw new Error('Authentication is required');
    const token = await user.getIdToken();
    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
  }, [user]);

  const uploadMedia = useCallback(async (media, filename) => {
    if (!media) return null;
    const blob = media instanceof Blob ? media : await fetch(media).then((response) => response.blob());
    const formData = new FormData();
    formData.append('file', blob, filename);
    const response = await fetchWithAuth(`${BACKEND_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Media upload failed with status ${response.status}`);
    }
    const data = await response.json();
    return data.url;
  }, [fetchWithAuth]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const initSocket = async () => {
      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        const socket = io(BACKEND_URL, { autoConnect: true, auth: { token } });
        socketRef.current = socket;
        socket.emit('realRegisterUser', user.uid);
        const handleReadUpdate = ({ messageIds, userId }) => {
          setMessages((prev) => prev.map((message) => messageIds.includes(message._id)
            ? { ...message, readBy: [...(message.readBy || []), userId] }
            : message));
        };
        socket.on('messages_read_update', handleReadUpdate);
        const removeCallListeners = callControllerRef.current?.registerSocketListeners?.(socket);
        let fcmDeviceToken = null;
        try {
          if ('serviceWorker' in navigator) {
            const messaging = getMessaging();
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            await navigator.serviceWorker.ready;
            fcmDeviceToken = await getToken(messaging, { vapidKey: 'BI2_PHDGRR7jW2ybN8Vyo_ozgB1TYjw5k9omVSDIsFMMaKUk8L6lInMVo63bXxe-19Rb7QQlLNPgpfnW_88_Q-A', serviceWorkerRegistration: registration });
          }
        } catch (error) { console.warn('FCM Token skipped:', error); }
        socket.emit('user_connected', { uid: user.uid, name: user.displayName, email: user.email, avatar: user.photoURL, pushSubscription: fcmDeviceToken });
        socket.on('active_users_list', (users) => setActiveUsers(Array.from(new Map(users.map((item) => [item.uid, item])).values())));
        socket.on('message_updated', (updatedMessage) => setMessages((prev) => prev.map((message) => message._id === updatedMessage._id ? updatedMessage : message)));
        socket.on('message_deleted', (deletedId) => setMessages((prev) => prev.filter((message) => message._id !== deletedId)));
        socket.on('receive_message', (message) => {
          if (message.room !== roomRef.current) return;
          if (message.parentId) {
            if (activeThreadMessageRef.current?._id === message.parentId) {
              setThreadMessages((prev) => [...prev, message]);
            }
            return;
          }
          setMessages((prev) => {
            const clientIndex = message.clientMessageId ? prev.findIndex((item) => item.clientMessageId === message.clientMessageId) : -1;
            if (clientIndex !== -1) return prev.map((item, index) => index === clientIndex ? message : item);
            const pendingIndex = message.senderUid === user.uid ? prev.findIndex((item) => item.pending && (item.text === message.text || (item.audio && message.audio))) : -1;
            if (pendingIndex !== -1) return prev.map((item, index) => index === pendingIndex ? message : item);
            return [...prev, message];
          });
        });
        socket.on('display_typing', ({ userName, room: typingRoom }) => { if (typingRoom === roomRef.current) setTypingUser(userName); });
        socket.on('hide_typing', ({ room: typingRoom }) => { if (typingRoom === roomRef.current) setTypingUser(null); });
        socket._removeCallListeners = removeCallListeners;
      } catch (error) { console.error('Socket init error:', error); }
    };
    initSocket();
    return () => {
      cancelled = true;
      socketRef.current?._removeCallListeners?.();
      socketRef.current?.off('messages_read_update');
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [user, callControllerRef]);

  useEffect(() => {
    if (!user) return undefined;
    setRoomLoading(true);
    setTypingUser(null);
    setHasMorePages(true);
    setUnreadCounts((prev) => ({ ...prev, [room]: 0 }));
    const controller = new AbortController();
    fetchWithAuth(`${BACKEND_URL}/api/messages?room=${room}&limit=30`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        setMessages(data);
        setRoomLoading(false);
        setHasMorePages(data.length === 30);
      })
      .catch((error) => { if (error.name !== 'AbortError') { console.error('Error loading chat history:', error); setRoomLoading(false); } });
    socketRef.current?.emit('join_room', room);
    return () => controller.abort();
  }, [fetchWithAuth, room, user]);

  useEffect(() => {
    if (!user) return;
    fetchWithAuth(`${BACKEND_URL}/api/users`).then((response) => response.json()).then(setAllRegisteredUsers).catch((error) => console.error('Failed to fetch registered users:', error));
  }, [fetchWithAuth, user]);

  useEffect(() => {
    if (!user || !messages.length || !socketRef.current) return;
    const messageIds = messages
      .filter((message) => message.senderUid !== user.uid && (!message.readBy || !message.readBy.includes(user.uid)))
      .map((message) => message._id);
    if (messageIds.length) socketRef.current.emit('mark_messages_read', { messageIds, userId: user.uid, room });
  }, [messages, room, user]);

  useEffect(() => {
    if (!activeThreadMessage) { setThreadMessages([]); return; }
    fetchWithAuth(`${BACKEND_URL}/api/messages/thread?parentId=${activeThreadMessage._id}`).then((response) => response.json()).then(setThreadMessages).catch((error) => console.error('Failed to load thread messages:', error));
  }, [activeThreadMessage, fetchWithAuth]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
          const response = await fetchWithAuth(`${BACKEND_URL}/api/messages/search?room=${room}&query=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          setSearchResults(await response.json());
        }
      } catch (error) { console.error('Failed to search messages:', error); }
      finally { /* Search state is represented by the current query/results. */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchWithAuth, searchQuery, room]);

  const handleSelectRoom = (selectedRoom) => { setRoom(selectedRoom); setIsMobileMenuOpen(false); };
  const handleOpenPrivateChat = (targetUser) => { setRoom([user.uid, targetUser.uid].sort().join('_')); setIsMobileMenuOpen(false); };
  const handleInputChange = (event) => {
    const value = event.target.value;
    setNewMessage(value);
    setSendError('');
    if (!socketRef.current) return;
    socketRef.current.emit('typing_start', { room, userName: user.displayName || user.email });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socketRef.current?.emit('typing_stop', { room }), 1500);
  };
  const handleGoogleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error('Login Failed:', error); } };
  const handleEmailLogin = async (email, password) => signInWithEmailAndPassword(auth, email, password);
  const handleResendVerification = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) await sendEmailVerification(auth.currentUser);
  };
  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return null;
    await auth.currentUser.reload();
    const refreshedUser = auth.currentUser;
    const isUnverifiedPasswordUser = refreshedUser.providerData.some((provider) => provider.providerId === 'password') && !refreshedUser.emailVerified;
    setUser(isUnverifiedPasswordUser ? null : { ...refreshedUser });
    return refreshedUser;
  }, []);
  const handleUpdateDisplayName = async (displayName) => {
    const trimmedName = displayName.trim();
    if (!trimmedName || !auth.currentUser) throw new Error('A display name is required');
    await updateProfile(auth.currentUser, { displayName: trimmedName });
    await auth.currentUser.getIdToken(true);
    socketRef.current?.emit('profile_updated', { name: trimmedName });
    setUser({ ...auth.currentUser });
  };
  const handleSendMessage = async (event) => {
    event.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || !socketRef.current || isSending) return;
    setIsSending(true);
    try {
      const imageUrl = selectedImage?.startsWith('data:')
        ? await uploadMedia(selectedImage, 'chat-image.jpg')
        : selectedImage;
      const clientMessageId = `client-${Date.now()}-${Math.random()}`;
      const text = newMessage.trim() || '\u200B';
      const optimisticMessage = { _id: clientMessageId, clientMessageId, text, sender: user.displayName || user.email, senderUid: user.uid, image: imageUrl || null, avatar: user.photoURL, room, createdAt: new Date(), pending: true };
      setNewMessage(''); setSelectedImage(null); setMessages((prev) => [...prev, optimisticMessage]);
      socketRef.current.emit('send_message', { clientMessageId, text, image: imageUrl || null, room }, (response) => {
        if (!response?.success) setSendError(response?.error || 'Message could not be saved.');
      });
    } catch (error) {
      setSendError(error.message || 'Could not upload this image.');
      console.error('Failed to upload image:', error);
    } finally {
      setIsSending(false);
    }
  };
  const handleEditMessage = (text) => { if (!text.trim() || !socketRef.current || !editingMessageId) return; socketRef.current.emit('edit_message', { messageId: editingMessageId, text, userId: user.uid, room }); setEditingMessageId(null); setEditingText(''); };
  const handleSendThreadReply = (event) => { event.preventDefault(); if (!threadInput.trim() || !socketRef.current || !activeThreadMessage) return; socketRef.current.emit('send_message', { text: threadInput.trim(), sender: user.displayName || user.email, senderUid: user.uid, avatar: user.photoURL, room, parentId: activeThreadMessage._id, createdAt: new Date() }, (response) => { if (response?.success) setThreadInput(''); else setSendError(response?.error || 'Reply could not be saved.'); }); };
  const handleSendAudio = async (audioBlob) => {
    if (!audioBlob || !socketRef.current) return false;
    setIsSending(true);
    try {
      const audioUrl = await uploadMedia(audioBlob, 'voice-note.webm');
      const clientMessageId = `client-${Date.now()}-${Math.random()}`;
      const optimisticMessage = { _id: clientMessageId, clientMessageId, text: '', audio: audioUrl, sender: user.displayName || user.email, senderUid: user.uid, avatar: user.photoURL, room, createdAt: new Date(), pending: true };
      setMessages((prev) => [...prev, optimisticMessage]);
      socketRef.current.emit('send_message', { clientMessageId, text: '', audio: audioUrl, room }, (response) => {
        if (!response?.success) setSendError(response?.error || 'Voice note could not be saved.');
      });
      return true;
    } catch (error) {
      setSendError(error.message || 'Could not upload this voice note.');
      console.error('Failed to upload audio:', error);
      return false;
    } finally {
      setIsSending(false);
    }
  };
  const handleImageSelect = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (loadEvent) => { const image = new Image(); image.src = loadEvent.target.result; image.onload = () => { const canvas = document.createElement('canvas'); const ratio = Math.min(1000 / image.width, 1000 / image.height, 1); canvas.width = image.width * ratio; canvas.height = image.height * ratio; canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); setSelectedImage(canvas.toDataURL('image/jpeg', 0.7)); }; };
  };
  const handlePaste = (event) => { Array.from(event.clipboardData.items).filter((item) => item.type.includes('image')).forEach((item) => { const file = item.getAsFile(); const reader = new FileReader(); reader.onloadend = () => setSelectedImage(reader.result); reader.readAsDataURL(file); }); };
  const loadMoreMessages = async () => { if (isFetchingMore || !hasMorePages || !messages.length) return false; setIsFetchingMore(true); try { const response = await fetchWithAuth(`${BACKEND_URL}/api/messages?room=${room}&limit=30&before=${messages[0].createdAt}`); const older = await response.json(); if (!older.length || older.length < 30) setHasMorePages(false); if (older.length) setMessages((prev) => [...older, ...prev]); return older.length > 0; } catch (error) { console.error('Failed to load older messages', error); return false; } finally { setIsFetchingMore(false); } };
  const highlightText = useCallback((text, highlight) => { if (!highlight.trim()) return text; const escaped = highlight.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'); const regex = new RegExp(`(${escaped})`, 'gi'); return text.split(regex).map((part, index) => regex.test(part) ? createElement('mark', { key: index }, part) : part); }, []);
  const formatLastSeen = (dateString) => { if (!dateString) return 'Offline'; const date = new Date(dateString); const now = new Date(); if (date.toDateString() === now.toDateString()) return `Last seen at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; const yesterday = new Date(); yesterday.setDate(now.getDate() - 1); if (date.toDateString() === yesterday.toDateString()) return `Last seen yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; return `Last seen on ${date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`; };
  const isPrivateRoom = room.includes('_');
  const activeHeaderUser = isPrivateRoom ? allRegisteredUsers.find((item) => item.uid === room.split('_').find((id) => id !== user?.uid)) : null;
  const activeHeaderTitle = activeHeaderUser?.name || `# ${room}`;
  const displayedMessages = searchQuery.trim() ? searchResults : messages;
  const filteredMessages = displayedMessages.filter((message) => !message.parentId && (!searchQuery.trim() || (message.text && message.text.toLowerCase().includes(searchQuery.toLowerCase()))));

  return { BACKEND_URL, ROOMS_LIST, user, loading, messages, activeUsers, newMessage, room, roomLoading, deleteModalMessageId, setDeleteModalMessageId, isDeleting, setIsDeleting, typingUser, unreadCounts, openMenuId, setOpenMenuId, isMobileMenuOpen, setIsMobileMenuOpen, showScrollBtn, setShowScrollBtn, selectedImage, setSelectedImage, isSendingImage, editingMessageId, setEditingMessageId, editingText, setEditingText, searchQuery, setSearchQuery, allRegisteredUsers, infoModalMessage, setInfoModalMessage, isSettingsOpen, setIsSettingsOpen, isFetchingMore, hasMorePages, activeThreadMessage, setActiveThreadMessage, threadMessages, threadInput, setThreadInput, searchInputRef, fileInputRef, messagesEndRef, socketRef, isPrivateRoom, activeHeaderTitle, activeHeaderUser, activeHeaderAvatar: activeHeaderUser?.avatar || null, isHeaderUserOnline: activeHeaderUser ? activeUsers.some((item) => item.uid === activeHeaderUser.uid) : false, filteredMessages, handleSelectRoom, handleOpenPrivateChat, handleInputChange, handleGoogleLogin, handleEmailLogin, handleResendVerification, refreshUser, handleUpdateDisplayName, handleSendMessage, handleEditMessage, handleSendThreadReply, handleSendAudio, handleImageSelect, handlePaste, loadMoreMessages, highlightText, formatLastSeen, setRoom, sendError };
}