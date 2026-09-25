import styles from '../styles/App.module.scss';

export default function TypingIndicator({ typingUser }) {
  if (!typingUser) return null;

  return (
    <div className={styles.typingIndicatorRow}>
      <div className={styles.typingBubble}>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
      </div>
      <span className={styles.typingText}>{typingUser} is typing...</span>
    </div>
  );
}