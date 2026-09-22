import styles from '../App.module.css';

export default function LoginCard({ onLogin }) {
  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.title}>Public Chat</h1>
        <p className={styles.subtitle}>Real-time public chat with google auth</p>
        <button onClick={onLogin} className={styles.googleBtn}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}