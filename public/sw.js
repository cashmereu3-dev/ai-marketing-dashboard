// Service worker for The Agency: shows approval notifications and opens the approvals page on tap.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'The Agency', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Approval needed';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'A draft is waiting for you.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'agency-approval',
      renotify: true,
      data: { url: data.url || '/approvals' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/approvals';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
