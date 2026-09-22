import styles from '../App.module.css';

export default function ChatInputForm({
  newMessage,
  handleInputChange,
  handlePaste,
  handleSendMessage,
  roomLoading,
  isSendingImage,
  fileInputRef,
  handleImageSelect
}) {
  return (
    <div className={styles.formWidthWrapper}>
      <form onSubmit={handleSendMessage} className={styles.chatForm}>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />
        
        <button type="button" onClick={() => fileInputRef.current.click()} className={styles.logoutBtn} style={{padding: '8px 12px', borderColor: '#374151', color: '#9ca3af', marginRight: '-4px'}}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/>
          </svg>
        </button>

        <input 
          type="text" 
          value={newMessage} 
          onChange={handleInputChange} 
          onPaste={handlePaste}
          placeholder={isSendingImage ? "Sending image asset..." : roomLoading ? "Loading room..." : "Type a message..."}
          disabled={roomLoading || isSendingImage}
          className={styles.chatInput} 
        />
        
        <button type="submit" disabled={roomLoading || isSendingImage} className={styles.sendBtn}>
           {isSendingImage ? (
             <span className={styles.inlineSpinner} />
           ) : (
             <>
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                 <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z"/>
               </svg>
               <span className={styles.btnText} style={{marginLeft: '6px'}}>Send</span>
             </>
           )}
        </button>
      </form>
    </div>
  );
}