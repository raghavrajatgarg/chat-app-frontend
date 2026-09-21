import { useState } from 'react';
import styles from '../App.module.css';

export default function Header({ user, searchQuery, setSearchQuery, searchInputRef, handleSvgClick, onToggleMobileMenu, onOpenSettings }) {
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isFullScreenSearchOpen, setIsFullScreenSearchOpen] = useState(false);

  return (
    <>
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

        {/* Desktop Search Bar */}
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
          {searchQuery && (
  <button 
    onClick={() => {
      setSearchQuery('');
      // Force input blur to drop the mobile keyboard smoothly
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      // Force the viewport container back to normal baseline layout boundaries
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }, 40);
    }} 
    className={styles.clearSearchBtn}
  >
    ×
  </button>
)}
        </div>

        {/* Right side: Mobile 3-dot menu & Gear Icon */}
        <div className={styles.headerRightControls}>
  <div className={styles.mobileMenuContainer}>
    <button 
      className={styles.threeDotBtn}
      popovertarget="mobile-header-popover"
      aria-label="More options"
    >
      <svg xmlns="http://w3.org" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
        <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
      </svg>
    </button>

    <div 
      id="mobile-header-popover" 
      popover="auto" 
      className={styles.headerDropdown}
    >
      <button 
        className={styles.dropdownSearchBtn}
        onClick={(e) => {
          // Native popovers require manual dismissal when triggering another UI state
          document.getElementById("mobile-header-popover")?.hidePopover();
          setIsFullScreenSearchOpen(true);
        }}
      >
        <svg xmlns="http://w3.org" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
        </svg>
        Search
      </button>
    </div>
  </div>

  <button onClick={onOpenSettings} className={styles.gearBtn} aria-label="User Settings">
    <svg xmlns="http://w3.org" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
      <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.988 1.988l.17.31c.452.83.223 1.875-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.988 1.988l.31-.17a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.988-1.988l-.17-.31a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.988-1.988l-.31.17a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.93 2.93 0 1 1 0-5.86 2.93 2.93 0 0 1 0 5.86z"/>
    </svg>
  </button>
</div>
      </header>

      {/* Full-Screen Search Overlay for Mobile */}
      {isFullScreenSearchOpen && (
        <div className={styles.fullScreenSearchOverlay}>
          <div className={styles.fullScreenSearchHeader}>
            <div className={styles.searchBarWrapper} style={{ maxWidth: '100%', margin: 0, display: 'flex' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={styles.searchSvg} viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
              </svg>
              <input 
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages in channel..."
                className={styles.headerSearchInput}
              />
              {searchQuery && (
  <button 
    onClick={() => {
      setSearchQuery('');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }, 40);
    }} 
    className={styles.clearSearchBtn}
  >
    ×
  </button>
)}
            </div>
            <button 
              className={styles.fullScreenSearchCloseBtn}
              onClick={() => setIsFullScreenSearchOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}