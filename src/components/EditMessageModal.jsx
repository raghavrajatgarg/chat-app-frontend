// src/components/EditMessageModal.jsx
import { useState, useEffect } from 'react';
import styles from '../App.module.css';

export default function EditMessageModal({ isOpen, initialText, onSave, onClose }) {
  const [text, setText] = useState(initialText || '');

  useEffect(() => {
    setText(initialText || '');
  }, [initialText]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%', textAlign: 'left' }}>
        <h3 className={styles.modalTitle} style={{ textAlign: 'center' }}>Edit Message</h3>
        <p className={styles.modalDescription} style={{ textAlign: 'center' }}>Modify your message below. Press <kbd>Enter</kbd> for newlines.</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={styles.editModalTextarea}
          rows={6}
          autoFocus
        />

        <div className={styles.modalActions} style={{ marginTop: '16px' }}>
          <button type="button" onClick={onClose} className={styles.modalCancelBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(text)}
            className={styles.editSaveBtn}
            style={{ flex: 1, padding: '10px' }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}