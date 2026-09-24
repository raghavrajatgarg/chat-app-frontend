import styles from '../App.module.css';

export default function Sidebar({ 
  roomsList, 
  room, 
  onSelectRoom, 
  onSelectPrivateChat, 
  unreadCounts, 
  activeUsers, 
  allUsers = [], 
  currentUser, 
  isMobileMenuOpen,
  onCloseMobileMenu,
  startCall
}) {
  
  const isUserOnline = (uid) => {
    return activeUsers.some((activeUser) => activeUser.uid === uid);
  };
  const formatLastSeen = (dateString) => {
  if (!dateString) return 'Offline';

  const lastSeenDate = new Date(dateString);
  const now = new Date();

  // Check if it's the same calendar day
  const isToday = lastSeenDate.toDateString() === now.toDateString();

  // Check if it was yesterday
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = lastSeenDate.toDateString() === yesterday.toDateString();

  if (isToday) {
    // Show just the time if today (e.g., "03:37 PM")
    return `Last seen at ${lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isYesterday) {
    // Show "Yesterday" plus time
    return `Last seen yesterday at ${lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    // Show full date and time if older than a day (e.g., "Oct 24, 03:37 PM")
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return `Last seen on ${lastSeenDate.toLocaleDateString([], options)}`;
  }
};
  return (
    <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
      <button 
        type="button"
        className={styles.mobileCloseBtn} 
        onClick={onCloseMobileMenu}
        aria-label="Close sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
        </svg>
      </button>

      <div className={styles.sidebarSection}>
        <h4 className={styles.sidebarTitle}>Channels</h4>
        <div className={styles.roomList}>
          {roomsList.map((channel) => (
            <button
              key={channel}
              onClick={() => onSelectRoom(channel)}
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
  <h4 className={styles.sidebarTitle}>Direct Messages</h4>
  <div className={styles.userList}>
    {allUsers
      .filter((u) => u.uid !== currentUser?.uid)
      .map((u) => {
        const online = isUserOnline(u.uid);
        const privateRoomId = [currentUser?.uid, u.uid].sort().join('_');
        const isActive = room === privateRoomId;

        return (
          <div
            key={u.uid}
            onClick={() => onSelectPrivateChat(u)}
            className={`${styles.roomBtn} ${isActive ? styles.roomBtnActive : ''}`}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img 
                  src={u.avatar || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTG2WvvTfYjXX8CEkilCI3cS_kYcqWAxegJwqTTIhmFqs3V4XHvSUORZWbj&s=10'} 
                  alt="" 
                  className={styles.userAvatar} 
                  style={{ width: '28px', height: '28px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', flex: 1, overflow: 'hidden' }}>
                <span className={styles.userName}>{u.name}</span>
                <span className={`${styles.lastSeen} ${isActive ? styles.lastSeenActive : ''}`} style={{ fontSize: '11px' }}>
                  {online ? 'Online' : formatLastSeen(u.lastSeen)}
                </span>
              </div>
            </div>

            {/* Call button separated cleanly as a standalone button */}
            {online && <div className={styles.statusDot} />}
          </div>
        );
      })}
  </div>
</div>
    </aside>
  );
}