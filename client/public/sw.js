self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data?.json() ?? {};
  } catch {
    d = { title: 'LeadAwaker', body: 'You have a new notification' };
  }
  e.waitUntil(self.registration.showNotification(d.title || 'LeadAwaker', {
    body: d.body, icon: '/icon-192.png', data: { link: d.link || '/' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cls) => {
      const existing = cls.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        if (e.notification.data?.link) existing.navigate(e.notification.data.link);
      } else {
        clients.openWindow(e.notification.data?.link || '/');
      }
    })
  );
});
