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
  onCloseMobileMenu
}) {
  
  const isUserOnline = (uid) => {
    return activeUsers.some((activeUser) => activeUser.uid === uid);
  };

  return (
    <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
      {/* Mobile Close Button */}
      <button 
        type="button"
        className={styles.mobileCloseBtn} 
        onClick={onCloseMobileMenu}
        aria-label="Close sidebar"
      >
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
</svg>
      </button>

      {/* Channels Section */}
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

      {/* Direct Messages Section */}
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
                <button
                  key={u.uid}
                  onClick={() => onSelectPrivateChat(u)}
                  className={`${styles.roomBtn} ${isActive ? styles.roomBtnActive : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img 
                        src={u.avatar || 'https://placeholder.com'} 
                        alt="" 
                        className={styles.userAvatar} 
                        style={{ width: '28px', height: '28px' }}
                      />
                    </div>
                    <span className={styles.userName} style={{ textAlign: 'left', flex: 1 }}>
                      {u.name}
                    </span>
                    {online && <div className={styles.statusDot} />}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </aside>
  );
}