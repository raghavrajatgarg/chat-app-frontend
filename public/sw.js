// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'New Message', body: 'You have a new message!' };
  
  const options = {
    body: data.body,
    icon: data.icon || '/placeholder.com',
    badge: '/badge.png', // Small icon shown in mobile status bars
    vibrate: [100, 50, 100], // Tactile phone vibration pattern chimes
    data: { url: data.url }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Open the chat room automatically when the user taps the notification banner
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
