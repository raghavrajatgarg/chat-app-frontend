import styles from '../styles/App.module.scss';

export default function DeleteModal({ isDeleting, onCancel, onDelete }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <h3 className={styles.modalTitle}>Delete message?</h3>
        <p className={styles.modalDescription}>This message will be permanently deleted.</p>
        
        {isDeleting ? (
          <div className={styles.modalLoadingWrapper}>
            <div className={styles.spinner} />
            <span>Deleting...</span>
          </div>
        ) : (
          <div className={styles.modalActions}>
            <button onClick={onCancel} className={styles.modalCancelBtn}>
              Cancel
            </button>
            <button onClick={onDelete} className={styles.modalDeleteBtn}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}