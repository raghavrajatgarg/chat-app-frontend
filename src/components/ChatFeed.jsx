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
  messagesEndRef
}) {
  return (
    <div className={styles.messageFeed}>
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
        messages
          .filter((msg) => !searchQuery.trim() || (msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase())))
          .map((msg, index) => {
            const isMe = msg.senderUid === user.uid;
            const timeString = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const isMenuOpen = openMenuId === msg._id;
          
            return (
              <div key={msg._id || index} className={styles.messageRow} style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div className={styles.messageContentWrapper} style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  {!isMe && <img src={msg.avatar || 'https://placeholder.com'} alt="" className={styles.messageAvatar} />}
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
                        <span className={styles.messageText}>
                          {msg.text !== "\u200B" && highlightText(msg.text, searchQuery)}
                          {msg.edited && <small className={styles.editedIndicatorTag}> (edited)</small>}
                          {msg.image && (
                            <img src={msg.image} alt="Sent asset" className={styles.chatImage} onClick={() => window.open(msg.image, '_blank')} />
                          )}
                        </span>
                      )}
                      <span className={isMe ? styles.messageTimestampMe : styles.messageTimestampOther}>{timeString}</span>
                    
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
                                Delete
                              </button>
                              <button 
                                onClick={() => { setOpenMenuId(null); setEditingMessageId(msg._id); setEditingText(msg.text); }}
                                className={styles.dropdownItemEdit}
                              >
                                Edit
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
          })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}