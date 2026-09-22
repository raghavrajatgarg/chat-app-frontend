import { useRef, useEffect, useLayoutEffect } from 'react';
import styles from '../App.module.css';

export default function ChatFeed({
  messages,
  user,
  searchQuery,
  roomLoading,
  room,
  selectedImage,
  isSendingImage,
  setSelectedImage,
  editingMessageId,
  setEditingMessageId,
  editingText,
  setEditingText,
  handleEditMessage,
  openMenuId,
  setOpenMenuId,
  setDeleteModalMessageId,
  highlightText,
  setInfoModalMessage,
  loadMoreMessages,
  hasMorePages,
  isFetchingMore,
  setShowScrollBtn,
  messagesEndRef
}) {
  const scrollContainerRef = useRef(null);
  const topSentinelRef = useRef(null);
  const firstMessageRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const hasInitializedRoom = useRef(false);
  const isFetchingRef = useRef(isFetchingMore);
  isFetchingRef.current = isFetchingMore;

  // Handle initial room load scroll to bottom & live new message scroll
  useEffect(() => {
    if (searchQuery.trim() || messages.length === 0 || roomLoading) return;

    const latestMessage = messages[messages.length - 1];
    const latestId = latestMessage?._id || messages.length;

    // If it's a fresh room load or a brand new message arrived at the bottom
    if (!hasInitializedRoom.current || lastMessageIdRef.current !== latestId) {
      messagesEndRef.current?.scrollIntoView({ behavior: !hasInitializedRoom.current ? 'auto' : 'smooth' });
      lastMessageIdRef.current = latestId;
      hasInitializedRoom.current = true;
    }
  }, [messages, searchQuery, roomLoading, messagesEndRef]);

  // Reset initialization flag when room changes
  useEffect(() => {
    hasInitializedRoom.current = false;
    lastMessageIdRef.current = null;
  }, [room]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 300);
  };

  // Intersection Observer for pre-fetching older messages
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMorePages && !isFetchingRef.current && !searchQuery.trim()) {
          firstMessageRef.current = scrollContainerRef.current?.querySelector('[data-message-id]');
          loadMoreMessages();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '150px 0px 0px 0px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMorePages, loadMoreMessages, searchQuery]);

  // Restore scroll position relative to the anchored message element when prepending history
  useLayoutEffect(() => {
    if (firstMessageRef.current) {
      firstMessageRef.current.scrollIntoView({ block: 'start' });
      firstMessageRef.current = null;
    }
  }, [messages]);

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className={styles.messageFeed}
      style={{ overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {roomLoading ? (
        <div className={styles.roomLoaderContainer}>
          <div className={styles.spinner} />
          <p className={styles.modalDescription} style={{ marginTop: '10px' }}>Switching to #{room}...</p>
        </div>
      ) : selectedImage ? (
        <div className={styles.previewContainer}>
          <img src={selectedImage} alt="Upload preview" className={styles.previewImage} />
          <button 
            type="button" 
            onClick={() => !isSendingImage && setSelectedImage(null)} 
            className={styles.removePreviewBtn}
            disabled={isSendingImage}
          >
            ×
          </button>
        </div>
      ) : (
        <>
          {!searchQuery.trim() && <div ref={topSentinelRef} style={{ height: '1px', width: '100%' }} />}

          {isFetchingMore && (
            <div style={{ textAlign: 'center', padding: '10px', color: '#888', fontSize: '12px' }}>
              Loading older messages...
            </div>
          )}

          {messages.map((msg, index) => {
            const isMe = msg.senderUid === user.uid;
            const timeString = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const isMenuOpen = openMenuId === msg._id;
          
            return (
              <div 
                key={msg._id || index} 
                data-message-id={msg._id || index}
                className={styles.messageRow} 
                style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}
              >
                <div className={styles.messageContentWrapper} style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  {!isMe && <img src={msg.avatar || 'https://placeholder.com'} alt="" className={styles.messageAvatar} referrerPolicy="no-referrer" />}
                  <div>
                    {!isMe && <small className={styles.messageSenderName}>{msg.sender}</small>}
                    <div className={`${styles.messageBubbleBase} ${isMe ? styles.messageBubbleMe : styles.messageBubbleOther}`}>
                      {editingMessageId === msg._id ? (
                        <div className={styles.editFormInline}>
                          <input 
                            type="text" 
                            value={editingText} 
                            onChange={(e) => setEditingText(e.target.value)} 
                            className={styles.editInputInline}
                            autoFocus
                          />
                          <div className={styles.editActionsInline}>
                            <button onClick={() => handleEditMessage(msg._id)} className={styles.editSaveBtn}>Save</button>
                            <button onClick={() => { setEditingMessageId(null); setEditingText(''); }} className={styles.editCancelBtn}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.messageText}>
                          {msg.image && (
                            <img src={msg.image} alt="Sent asset" className={styles.chatImage} onClick={() => window.open(msg.image, '_blank')} />
                          )}
                          <div className={styles.messageFooterRow}>
                            <span>
                              {msg.text !== "\u200B" && highlightText(msg.text, searchQuery)}
                              {msg.edited && <small className={styles.editedIndicatorTag}> (edited)</small>}
                            </span>
                            <span className={isMe ? styles.messageTimestampMe : styles.messageTimestampOther}>{timeString}</span>
                          </div>
                        </div>
                      )}
                      
                      {isMe && msg._id && (
                        <div className={`${styles.messageActionTrigger} ${isMenuOpen ? styles.forceVisible : ''}`}>
                          <button 
                            onClick={() => setOpenMenuId(isMenuOpen ? null : msg._id)} 
                            className={styles.optionsButton}
                            title="Message options"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                            </svg>
                          </button>
                      
                          {isMenuOpen && (
                            <div className={styles.dropdownMenu}>
                              <button 
                                onClick={() => { setOpenMenuId(null); setDeleteModalMessageId(msg._id); }}
                                className={styles.dropdownItemDelete}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                                  <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                                </svg>
                                <span>Delete</span>
                              </button>
                              <button 
                                onClick={() => { setOpenMenuId(null); setEditingMessageId(msg._id); setEditingText(msg.text); }}
                                className={styles.dropdownItemEdit}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z"/>
                                </svg>
                                Edit
                              </button>
                              {msg.senderUid === user.uid && (
                                <button 
                                  className={styles.dropdownItemInfo} 
                                  onClick={() => {
                                    setInfoModalMessage(msg);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
                                  </svg>
                                  Info
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}