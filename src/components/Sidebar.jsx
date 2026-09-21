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
  isMobileMenuOpen 
}) {
  
  // Helper to check if a specific user is currently online
  const isUserOnline = (uid) => {
    return activeUsers.some((activeUser) => activeUser.uid === uid);
  };

  return (
    <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
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

      {/* Direct Messages / All Users Section */}
      <div className={styles.sidebarSection}>
        <h4 className={styles.sidebarTitle}>Direct Messages</h4>
        <div className={styles.userList}>
          {allUsers
            .filter((u) => u.uid !== currentUser?.uid) // Don't show yourself in the DM list
            .map((u) => {
              const online = isUserOnline(u.uid);
              
              // Generate the private room ID to check if this DM is currently active
              const privateRoomId = [currentUser?.uid, u.uid].sort().join('_');
              const isActive = room === privateRoomId;

              return (
                <button
                  key={u.uid}
                  onClick={() => onSelectPrivateChat(u)}
                  className={`${styles.roomBtn} ${isActive ? styles.roomBtnActive : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', overflow: 'hidden' }}>
                    {/* Avatar with absolute green dot indicator */}
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
                                         {online && (
                        <div 
                          className={styles.statusDot} 
                        />
                      )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </aside>
  );
}