import styles from '../App.module.css';

export default function ThreadView({
  activeThreadMessage,
  setActiveThreadMessage,
  threadMessages,
  user,
  threadInput,
  setThreadInput,
  handleSendThreadReply,
}) {
  if (!activeThreadMessage) return null;

  return (
    <div className={styles.threadDrawer}>
      <div className={styles.threadHeader}>
        <h3>Thread</h3>
        <button onClick={() => setActiveThreadMessage(null)} className={styles.closeThreadBtn}>×</button>
      </div>

      <div className={styles.originalMessagePreview}>
        <strong>{activeThreadMessage.sender}:</strong> {activeThreadMessage.text}
      </div>

      <div className={styles.threadMessagesFeed} style={{ overflowY: 'auto', flex: 1, padding: '10px' }}>
        {threadMessages.map((msg, index) => {
          const msgId = msg._id || msg.id;
          const isMe = msg.senderUid === user.uid;
          const timeString = msg.createdAt
            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div
              key={msgId || index}
              className={styles.messageRow}
              style={{ justifyContent: isMe ? 'flex-end' : 'flex-start', margin: '8px 0' }}
            >
              <div className={styles.messageContentWrapper} style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                {!isMe && <img src={msg.avatar || 'https://placeholder.com'} alt="" className={styles.messageAvatar} />}
                <div>
                  {!isMe && <small className={styles.messageSenderName}>{msg.sender}</small>}

                  <div className={`${styles.messageBubbleBase} ${isMe ? styles.messageBubbleMe : styles.messageBubbleOther}`}>
                    <div className={styles.messageText}>
                      {msg.image && (
                        <img src={msg.image} alt="Sent asset" className={styles.chatImage} onClick={() => window.open(msg.image, '_blank')} />
                      )}
                      <div className={styles.messageFooterRow}>
                        <span>{msg.text}</span>
                        <span className={isMe ? styles.messageTimestampMe : styles.messageTimestampOther}>{timeString}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSendThreadReply} className={styles.threadForm}>
        <input
          type="text"
          value={threadInput}
          onChange={(e) => setThreadInput(e.target.value)}
          placeholder="Reply in thread..."
          className={styles.threadInput}
        />
        <button type="submit" className={styles.threadSendBtn}>Send</button>
      </form>
    </div>
  );
}