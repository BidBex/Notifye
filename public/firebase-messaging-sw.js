/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCXZ1VBwTjAx1YiOfNl4x3hmc5-lwNMzr0",
  authDomain: "animated-spot-rmn89.firebaseapp.com",
  projectId: "animated-spot-rmn89",
  storageBucket: "animated-spot-rmn89.firebasestorage.app",
  messagingSenderId: "538067499467",
  appId: "1:538067499467:web:17d8a2e56472122abd9e4e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'Notifye';
  const body = payload?.notification?.body || 'Your partner wants your attention';
  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'tether-partner-ping',
    renotify: true,
    vibrate: [80, 60, 120],
    data: {
      url: payload?.data?.url || '/',
    },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
