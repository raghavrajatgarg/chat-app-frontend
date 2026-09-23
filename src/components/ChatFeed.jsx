import { useRef, useEffect, useState, useLayoutEffect } from 'react';
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
  setActiveThreadMessage,
  messagesEndRef
}) {
  const scrollContainerRef = useRef(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const anchorMessageIdRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  // Reset references when changing rooms
  useEffect(() => {
    lastMessageIdRef.current = null;
    anchorMessageIdRef.current = null;
  }, [room]);

  // Filter messages based on search query if user is searching
  const filteredMessages = messages.filter(
    (msg) => !searchQuery.trim() || (msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle scroll to check for loading older messages or closing dropdowns
  const handleScroll = async (e) => {
    const { scrollTop } = e.target;
    
    // Trigger when user scrolls near the top
    if (scrollTop <= 20 && typeof loadMoreMessages === 'function' && !searchQuery.trim() && !isFetchingMore && filteredMessages.length > 0) {
      anchorMessageIdRef.current = filteredMessages[0]._id || filteredMessages[0].id;
      
      setIsFetchingMore(true);
      try {
        await loadMoreMessages();
      } catch (error) {
        console.error("Failed to load more messages:", error);
      } finally {
        setIsFetchingMore(false);
      }
    }

    if (openMenuId) {
      setOpenMenuId(null);
    }
  };
  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If no menu is open, do nothing
      if (!openMenuId) return;

      // Check if the click happened inside an options menu or action trigger
      const clickedInsideMenu = event.target.closest(`.${styles.dropdownMenu}`) || 
                                event.target.closest(`.${styles.dropdownMenuFlipped}`) || 
                                event.target.closest(`.${styles.messageActionTrigger}`);

      if (!clickedInsideMenu) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId, setOpenMenuId]);
  // Restore scroll position precisely to the anchored message after older messages load
  useLayoutEffect(() => {
    if (anchorMessageIdRef.current && scrollContainerRef.current) {
      const element = scrollContainerRef.current.querySelector(`[data-message-id="${anchorMessageIdRef.current}"]`);
      if (element) {
        element.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
      anchorMessageIdRef.current = null;
    }
  }, [messages.length]);

  // Scroll to bottom ONLY when a genuinely new message is appended at the end or on initial load
  useEffect(() => {
    if (searchQuery.trim() || messages.length === 0 || isFetchingMore || anchorMessageIdRef.current) return;

    const lastMsg = messages[messages.length - 1];
    const lastMsgId = lastMsg?._id || lastMsg?.id;

    if (lastMsgId && lastMsgId !== lastMessageIdRef.current) {
      const isInitialLoad = lastMessageIdRef.current === null;
      lastMessageIdRef.current = lastMsgId;
      
      if (messagesEndRef?.current) {
        messagesEndRef.current.scrollIntoView({ behavior: isInitialLoad ? 'auto' : 'smooth' });
      }
    }
  }, [messages, searchQuery, messagesEndRef, isFetchingMore]);

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className={styles.messageFeed}
      style={{ overflowY: 'auto', height: '100%', position: 'relative' }}
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
        <div className={styles.messagesListContainer}>
          {isFetchingMore && (
            <div className={styles.topLoaderContainer} style={{ textAlign: 'center', padding: '12px 0' }}>
              <div className={styles.spinner} style={{ width: '20px', height: '20px', margin: '0 auto' }} />
            </div>
          )}

          {filteredMessages.map((msg, index) => {
            const msgId = msg._id || msg.id;
            const isMe = msg.senderUid === user.uid;
            const timeString = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const isMenuOpen = openMenuId === msgId;
            const isNearBottom = index >= filteredMessages.length - 3;
          
            return (
              <div 
                key={msgId || index}
                data-message-id={msgId}
                className={styles.messageRow} 
                style={{ 
                  justifyContent: isMe ? 'flex-end' : 'flex-start', 
                  position: 'relative', 
                  zIndex: isMenuOpen ? 100 : 1 
                }}
              >
                <div className={styles.messageContentWrapper} style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  {!isMe && <img src={msg.avatar || 'https://placeholder.com'} alt="" className={styles.messageAvatar} />}
                  <div>
                    {!isMe && <small className={styles.messageSenderName}>{msg.sender}</small>}
                    
                    <div 
                      className={`${styles.messageBubbleBase} ${isMe ? styles.messageBubbleMe : styles.messageBubbleOther}`}
                      style={{ position: 'relative', paddingRight: msgId ? '28px' : '14px' }}
                    >
                      {editingMessageId === msgId ? (
                        <div className={styles.editFormInline}>
                          <input 
                            type="text" 
                            value={editingText} 
                            onChange={(e) => setEditingText(e.target.value)} 
                            className={styles.editInputInline}
                            autoFocus
                          />
                          <div className={styles.editActionsInline}>
                            <button onClick={() => handleEditMessage(msgId)} className={styles.editSaveBtn}>Save</button>
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
                      
                      {msgId && (
                        <div 
                          className={`${styles.messageActionTrigger} ${isMenuOpen ? styles.forceVisible : ''}`} 
                          style={{ position: 'absolute', top: '6px', right: '6px' }}
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(isMenuOpen ? null : msgId);
                            }} 
                            className={styles.optionsButton}
                            title="Message options"
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              width="14" 
                              height="14" 
                              fill="currentColor" 
                              viewBox="0 0 16 16"
                              style={{ 
                                transform: isNearBottom ? 'rotate(180deg)' : 'rotate(0deg)', 
                                transition: 'transform 0.2s ease' 
                              }}
                            >
                              <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                            </svg>
                          </button>
                      
                          {isMenuOpen && (
                            <div className={isNearBottom ? styles.dropdownMenuFlipped : styles.dropdownMenu}>
                              {isMe && (
                                <>
                                  <button 
                                    onClick={() => { setOpenMenuId(null); setDeleteModalMessageId(msgId); }}
                                    className={styles.dropdownItemDelete}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                                      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                                    </svg>
                                    <span>Delete</span>
                                  </button>
                                  <button 
                                    onClick={() => { setOpenMenuId(null); setEditingMessageId(msgId); setEditingText(msg.text); }}
                                    className={styles.dropdownItemEdit}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                      <path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z"/>
                                    </svg>
                                    Edit
                                  </button>
                                </>
                              )}
                              {isMe && (
                                <button 
                                  className={styles.dropdownItemInfo} 
                                  onClick={() => {
                                    setInfoModalMessage(msg);
                                    setOpenMenuId(null);
                                  }}
                                  style={{marginBottom:5}}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1,1,0 1,1-2,0 1,1 0 0,1 2,0"/>
                                  </svg>
                                  Info
                                </button>
                              )}
                              <button 
                                onClick={() => { setOpenMenuId(null); setActiveThreadMessage(msg); }} 
                                className={styles.threadReplyTriggerBtn}
                                title="Reply in thread"
                              >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12.793a.5.5 0 0 0 .854.353l2.853-2.853A1 1 0 0 1 4.414 12H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/>
                                <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5M3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6m0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/>
                              </svg>
                                <span>Thread</span>
                              </button>

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
        </div>
      )}
    </div>
  );
}