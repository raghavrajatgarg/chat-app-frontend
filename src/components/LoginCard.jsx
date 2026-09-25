import { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import styles from '../App.module.css';
import { auth } from '../firebase';

const firebaseErrorMessages = {
  'auth/email-already-in-use': 'An account already exists with this email. Try signing in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/user-not-found': 'No account was found with this email.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
  'auth/password-does-not-meet-requirements': 'Choose a stronger password that meets the password requirements.',
  'auth/user-disabled': 'This account has been disabled. Contact support for help.',
  'auth/too-many-requests': 'Too many attempts were made. Wait a moment and try again.',
  'auth/network-request-failed': 'We could not connect to Firebase. Check your internet connection.',
  'auth/operation-not-allowed': 'Email and password sign-in is not enabled yet.',
  'auth/requires-recent-login': 'For security, sign in again before changing this setting.',
  'auth/quota-exceeded': 'The email service limit was reached. Please try again later.',
};

function getFriendlyFirebaseError(error) {
  if (error?.message === 'Passwords do not match.') return error.message;
  return firebaseErrorMessages[error?.code] || 'Something went wrong. Please check your details and try again.';
}

export default function LoginCard({ onLogin, onEmailLogin, onRefreshUser, onUpdateDisplayName, onPreview }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    if (currentUser && !currentUser.emailVerified) setPendingUser(currentUser);
  }), []);

  const submitEmail = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);
        setPendingUser(credential.user);
        setMessage('Verification email sent. Check your inbox before continuing.');
      } else {
        const credential = await onEmailLogin(email, password);
        if (!credential.user.emailVerified) {
          setPendingUser(credential.user);
          setMessage('Please verify your email before entering the chat.');
          await sendEmailVerification(credential.user);
        }
      }
    } catch (submitError) {
      setError(getFriendlyFirebaseError(submitError));
    }
  };

  const checkVerification = async () => {
    setError('');
    try {
      const verifiedUser = await onRefreshUser();
      if (!verifiedUser?.emailVerified) {
        setError('The email is not verified yet. Open the email link, then try again.');
      } else {
        setPendingUser(verifiedUser);
        setMode('name');
      }
    } catch (verificationError) {
      setError(getFriendlyFirebaseError(verificationError));
    }
  };

  const saveName = async (event) => {
    event.preventDefault();
    if (!name.trim()) return setError('Enter a display name.');
    try {
      await onUpdateDisplayName(name);
    } catch (nameError) {
      setError(getFriendlyFirebaseError(nameError));
    }
  };

  const resendVerification = async () => {
    try {
      await sendEmailVerification(auth.currentUser);
      setMessage('A new verification email was sent.');
    } catch (resendError) {
      setError(getFriendlyFirebaseError(resendError));
    }
  };

  if (pendingUser && mode !== 'name') {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 className={styles.title}>Check your inbox</h1>
          <p className={styles.subtitle}>We sent a verification link to {pendingUser.email}.</p>
          {message && <p className={styles.authMessage}>{message}</p>}
          {error && <p className={styles.authError} role="alert">{error}</p>}
          <button type="button" onClick={checkVerification} className={styles.googleBtn}>I verified my email</button>
          <button type="button" onClick={resendVerification} className={styles.authSecondaryAction}>Resend email</button>
          <button type="button" onClick={() => { setPendingUser(null); signOut(auth); }} className={styles.authSecondaryAction}>Use another account</button>
        </div>
      </div>
    );
  }

  if (mode === 'name') {
    return (
      <div className={styles.loginContainer}>
        <form className={styles.loginCard} onSubmit={saveName}>
          <h1 className={styles.title}>Choose your name</h1>
          <p className={styles.subtitle}>This name will be shown globally in the chat.</p>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name" required />
          {error && <p className={styles.authError} role="alert">{error}</p>}
          <button type="submit" className={styles.googleBtn}>Continue</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      <form className={styles.loginCard} onSubmit={submitEmail}>
        <h1 className={styles.title}>Public Chat</h1>
        <p className={styles.subtitle}>Sign in securely with Firebase</p>
        <button type="button" onClick={onLogin} className={styles.googleBtn}>
          Continue with Google
        </button>
        <button type="button" onClick={onPreview} className={styles.previewBtn}>
          Explore a live preview
        </button>
        <p className={styles.authDivider}>or use email</p>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required />
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" minLength={6} required />
        {mode === 'signup' && <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" minLength={6} required />}
        {error && <p className={styles.authError} role="alert">{error}</p>}
        <button type="submit" className={styles.googleBtn}>{mode === 'signup' ? 'Create account' : 'Sign in with email'}</button>
        <button type="button" className={styles.authSecondaryAction} onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}>
          {mode === 'signup' ? 'Already have an account?' : 'Create an account'}
        </button>
      </form>
    </div>
  );
}