// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize the Firebase app inside the background thread script
firebase.initializeApp({
  apiKey: "AIzaSyDW-CyZQnI7meaIFBVdQc6iRM37qjStkB8",
  authDomain: "chatapp-7e398.firebaseapp.com",
  projectId: "chatapp-7e398",
  storageBucket: "chatapp-7e398.firebasestorage.app",
  messagingSenderId: "566031305634",
  appId: "1:566031305634:web:3a67afa23774a4cac200fb",
});

const messaging = firebase.messaging();

// 🌟 Google automatically catches the background event payload and forces the mobile banner open!
messaging.onBackgroundMessage((payload) => {
  console.log('🚀 Received background message payload context: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.data.icon || '/placeholder.com',
    data: { url: payload.data.url }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
