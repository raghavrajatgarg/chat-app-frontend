import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDW-CyZQnI7meaIFBVdQc6iRM37qjStkB8",
  authDomain: "chatapp-7e398.firebaseapp.com",
  projectId: "chatapp-7e398",
  storageBucket: "chatapp-7e398.firebasestorage.app",
  messagingSenderId: "566031305634",
  appId: "1:566031305634:web:3a67afa23774a4cac200fb",
  measurementId: "G-R2VSL9L1HT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();