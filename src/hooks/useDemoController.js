import { useCallback, useMemo, useRef, useState } from 'react';

const ROOMS_LIST = ['general', 'tech', 'random', 'gaming'];
const DEMO_USERS = [
  { uid: 'demo-ava', name: 'Ava Chen', email: 'ava@example.test', avatar: 'https://i.pravatar.cc/96?img=47', lastSeen: new Date().toISOString() },
  { uid: 'demo-mateo', name: 'Mateo Silva', email: 'mateo@example.test', avatar: 'https://i.pravatar.cc/96?img=12', lastSeen: new Date().toISOString() },
  { uid: 'demo-nora', name: 'Nora Williams', email: 'nora@example.test', avatar: 'https://i.pravatar.cc/96?img=32', lastSeen: new Date().toISOString() },
];

const now = (minutesAgo) => new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
const DEMO_MESSAGES = [
  { _id: 'demo-general-1', room: 'general', text: 'Welcome to the sandbox. Try sending a message, image, or voice note.', sender: 'Ava Chen', senderUid: 'demo-ava', avatar: DEMO_USERS[0].avatar, createdAt: now(8), readBy: [] },
  { _id: 'demo-general-2', room: 'general', text: 'Nothing here is saved to the real chat.', sender: 'Mateo Silva', senderUid: 'demo-mateo', avatar: DEMO_USERS[1].avatar, createdAt: now(5), readBy: [] },
  { _id: 'demo-tech-1', room: 'tech', text: 'This is a private browser-only preview of the tech channel.', sender: 'Nora Williams', senderUid: 'demo-nora', avatar: DEMO_USERS[2].avatar, createdAt: now(12), readBy: [] },
  { _id: 'demo-random-1', room: 'random', text: 'Drop a thought here and test search, reactions, and threads.', sender: 'Ava Chen', senderUid: 'demo-ava', avatar: DEMO_USERS[0].avatar, createdAt: now(18), readBy: [] },
  { _id: 'demo-gaming-1', room: 'gaming', text: 'The demo has separate rooms just like the full app.', sender: 'Mateo Silva', senderUid: 'demo-mateo', avatar: DEMO_USERS[1].avatar, createdAt: now(22), readBy: [] },
];

export default function useDemoController() {
  const [messages, setMessages] = useState(DEMO_MESSAGES);
  const [user, setUser] = useState({ uid: 'demo-visitor', displayName: 'Demo Visitor', email: 'preview@example.test', photoURL: 'https://i.pravatar.cc/96?img=68' });
  const [room, setRoom] = useState('general');
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeThreadMessage, setActiveThreadMessage] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadInput, setThreadInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deleteModalMessageId, setDeleteModalMessageId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const activeUsers = DEMO_USERS;
  const activeHeaderUser = room.includes('_') ? DEMO_USERS[0] : null;
  const roomMessages = messages.filter((message) => message.room === room);
  const filteredMessages = roomMessages.filter((message) => !message.parentId && (!searchQuery.trim() || message.text.toLowerCase().includes(searchQuery.toLowerCase())));

  const addLocalMessage = useCallback((message) => {
    setMessages((previous) => [...previous, { ...message, _id: `demo-${Date.now()}-${Math.random()}`, room, sender: user.displayName, senderUid: user.uid, avatar: user.photoURL, createdAt: new Date().toISOString(), pending: false }]);
  }, [room, user]);

  const handleSendMessage = (event) => {
    event.preventDefault();
    if (!newMessage.trim() && !selectedImage) return;
    addLocalMessage({ text: newMessage.trim(), image: selectedImage || null });
    setNewMessage('');
    setSelectedImage(null);
  };

  const handleSendAudio = async (audioBlob) => {
    if (!audioBlob) return false;
    addLocalMessage({ text: '', audio: URL.createObjectURL(audioBlob) });
    return true;
  };

  const handleSendThreadReply = (event) => {
    event.preventDefault();
    if (!threadInput.trim() || !activeThreadMessage) return;
    const reply = { _id: `demo-thread-${Date.now()}`, text: threadInput.trim(), sender: user.displayName, senderUid: user.uid, avatar: user.photoURL, parentId: activeThreadMessage._id, createdAt: new Date().toISOString() };
    setThreadMessages((previous) => [...previous, reply]);
    setThreadInput('');
  };

  const handleEditMessage = (text) => {
    if (!text.trim() || !editingMessageId) return;
    setMessages((previous) => previous.map((message) => message._id === editingMessageId ? { ...message, text, edited: true } : message));
    setEditingMessageId(null);
    setEditingText('');
  };

  const deleteMessage = () => {
    setIsDeleting(true);
    setMessages((previous) => previous.filter((message) => message._id !== deleteModalMessageId));
    setTimeout(() => { setIsDeleting(false); setDeleteModalMessageId(null); }, 250);
  };

  const handleSelectRoom = (nextRoom) => { setRoom(nextRoom); setIsMobileMenuOpen(false); setActiveThreadMessage(null); };
  const handleOpenPrivateChat = () => { setRoom('demo-visitor_demo-ava'); setIsMobileMenuOpen(false); };
  const handleInputChange = (event) => setNewMessage(event.target.value);
  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSelectedImage(reader.result);
    reader.readAsDataURL(file);
  };
  const handlePaste = (event) => {
    const item = Array.from(event.clipboardData.items).find((clipboardItem) => clipboardItem.type.includes('image'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setSelectedImage(reader.result);
    reader.readAsDataURL(file);
  };
  const updateDisplayName = async (name) => { setUser((previous) => ({ ...previous, displayName: name.trim() })); };
  const highlightText = (text) => text;
  const formatLastSeen = () => 'Online in preview';
  const displayedUsers = useMemo(() => [{ uid: 'demo-ava', name: 'Ava Chen', avatar: DEMO_USERS[0].avatar, lastSeen: new Date().toISOString() }], []);

  return {
    isDemo: true, BACKEND_URL: '', ROOMS_LIST, user, loading: false, messages, activeUsers, newMessage, room, roomLoading: false,
    deleteModalMessageId, setDeleteModalMessageId, isDeleting, typingUser: null, unreadCounts: {}, openMenuId, setOpenMenuId,
    isMobileMenuOpen, setIsMobileMenuOpen, showScrollBtn, setShowScrollBtn, selectedImage, setSelectedImage, isSendingImage: false,
    editingMessageId, setEditingMessageId, editingText, setEditingText, searchQuery, setSearchQuery, allRegisteredUsers: displayedUsers,
    infoModalMessage, setInfoModalMessage, isSettingsOpen, setIsSettingsOpen, isFetchingMore: false, hasMorePages: false,
    activeThreadMessage, setActiveThreadMessage, threadMessages, threadInput, setThreadInput, searchInputRef, fileInputRef,
    messagesEndRef, socketRef: { current: null }, isPrivateRoom: room.includes('_'), activeHeaderTitle: activeHeaderUser?.name || `# ${room}`,
    activeHeaderUser, activeHeaderAvatar: activeHeaderUser?.avatar || null, isHeaderUserOnline: true, filteredMessages,
    handleSelectRoom, handleOpenPrivateChat, handleInputChange, handleSendMessage, handleEditMessage, handleSendThreadReply,
    handleSendAudio, handleImageSelect, handlePaste, loadMoreMessages: async () => {}, highlightText, formatLastSeen,
    handleUpdateDisplayName: updateDisplayName, deleteMessage, setRoom,
  };
}
