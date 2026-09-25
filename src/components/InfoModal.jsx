import { useState } from 'react';
import styles from '../styles/App.module.scss';

export default function InfoModal({ message, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!message) return null;

  // Ensure readBy is safely parsed as an array
  const readReceipts = Array.isArray(message.readBy) ? message.readBy : [];

  // Safely filter users, falling back to empty strings if name is missing
  const filteredReaders = readReceipts.filter((reader) => {
    const name = reader?.name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard} style={{ maxWidth: '420px', width: '100%', textAlign: 'left' }}>

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className={styles.modalTitle} style={{ margin: 0 }}>Message Info</h3>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeThreadBtn}
            style={{ fontSize: '22px', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Message Content Preview Snippet */}
        <div className={styles.originalMessagePreview} style={{ borderRadius: '8px', marginBottom: '16px' }}>
          <strong>{message.sender}:</strong> {message.text || (message.image ? '[Image Asset]' : '[Voice Note]')}
        </div>

        {/* Feature 2: Interactive Search/Filter Bar */}
        <div className={styles.searchBarWrapper} style={{ maxWidth: '100%', margin: '0 0 16px 0', background: 'var(--bg-input)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className={styles.searchSvg} viewBox="0 0 16 16">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search read by name..."
            className={styles.headerSearchInput}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className={styles.clearSearchBtn} style={{ right: '8px' }}>
              ×
            </button>
          )}
        </div>

        {/* Read Receipt List with Timestamps */}
        <h4 className={styles.sidebarTitle} style={{ marginBottom: '8px' }}>
          Read By ({filteredReaders.length})
        </h4>

        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {filteredReaders.length > 0 ? (
            filteredReaders.map((reader) => {
              const readTime = reader.readAt
                ? new Date(reader.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                : 'Just now';

              return (
                <div
                  key={reader.uid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={reader.avatar || 'https://placeholder.com'}
                      alt=""
                      className={styles.userAvatar}
                      style={{ width: '28px', height: '28px' }}
                    />
                    <span style={{ fontSize: '13px', color: '#f3f4f6', fontWeight: 500 }}>{reader.name}</span>
                  </div>

                  {/* Feature 1: Read Timestamp Tracking */}
                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                    {readTime}
                  </span>
                </div>
              );
            })
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: '13px', padding: '20px 0' }}>
              No matches found or unread by others.
            </p>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className={styles.modalCancelBtn} style={{ padding: '8px 16px', fontSize: '13px' }}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
}