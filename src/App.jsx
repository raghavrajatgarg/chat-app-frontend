import { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

// 1. Dynamically toggle backend targets between local dev and live Render production
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Failed:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const callProtectedBackend = async () => {
    try {
      const token = await user.getIdToken();
      // 2. Swapped hardcoded URL for the configurable parameter hook
      const response = await fetch(`${BACKEND_URL}/api/room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomName: 'Private Lounge' })
      });
      
      const data = await response.json();
      
      // 3. Smart alert checking to handle backend exception payloads smoothly
      if (response.ok) {
        alert(data.message || "Success! 🚀");
      } else {
        alert(`Server Error: ${data.error || 'Unauthorized Access'}`);
      }
    } catch (err) {
      console.error("Network request failed:", err);
      alert("Could not reach backend server.");
    }
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading workspace...</div>;

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
      {!user ? (
        <button onClick={handleGoogleLogin} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
          Sign in with Google
        </button>
      ) : (
        <div>
          <h2>Welcome, {user.displayName}!</h2>
          {user.photoURL && <img src={user.photoURL} alt="Profile" width="60" style={{ borderRadius: '50%' }} />}
          <p>{user.email}</p>
          <div style={{ margin: '20px' }}>
            <button onClick={callProtectedBackend} style={{ padding: '8px 15px', marginRight: '10px', cursor: 'pointer' }}>
              Test Secure API Request
            </button>
            <button onClick={handleLogout} style={{ padding: '8px 15px', background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
