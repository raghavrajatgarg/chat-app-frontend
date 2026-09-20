import styles from '../App.module.css';

export default function Header({ user, searchQuery, setSearchQuery, searchInputRef, handleSvgClick, onToggleMobileMenu, onLogout }) {
  return (
    <header className={styles.header}>
      <button 
        className={styles.hamburgerButton} 
        onClick={onToggleMobileMenu}
        aria-label="Toggle navigation menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
        </svg>  
      </button>
      
      <div className={styles.headerLeft}>
        <img src={user?.photoURL} alt="Profile" className={styles.profileImg} />
        <div className={styles.headerUserInfo}>
          <span className={styles.headerUserName}>{user?.displayName}</span>
          <span className={styles.liveIndicator}>● Live Node Link</span>
        </div>
      </div>

      <div className={styles.searchBarWrapper}>
        <svg onClick={handleSvgClick} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={styles.searchSvg} viewBox="0 0 16 16">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
        </svg>
        <input 
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search messages in channel..."
          className={styles.headerSearchInput}
        />
        {searchQuery && <button onClick={() => setSearchQuery('')} className={styles.clearSearchBtn}>×</button>}
      </div>

      <button onClick={onLogout} className={styles.logoutBtn}>Log Out</button>
    </header>
  );
}