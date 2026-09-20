import styles from '../App.module.css';

export default function Sidebar({ roomsList, room, onSelectRoom, unreadCounts, activeUsers, isMobileMenuOpen }) {
  return (
    <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
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
        <h4 className={styles.sidebarTitle}>Online users</h4>
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
    </aside>
  );
}