// P-EAK 푸시 알림 핸들러

// Push 알림 수신
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    if (!event.data) {
        console.log('[SW] No data in push event');
        return;
    }

    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: 'P-EAK', body: event.data.text() };
    }

    const { title, body, icon, badge, data: notificationData } = data;

    const options = {
        body: body || '',
        icon: icon || '/peak-192x192.png',
        badge: badge || '/peak-192x192.png',
        vibrate: [100, 50, 100],
        data: notificationData || {},
        tag: 'peak-notification',
        renotify: true,
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification(title || 'P-EAK 알림', options)
    );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // 이미 열린 P-EAK 창이 있으면 포커스
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.focus();
                        if ('navigate' in client) {
                            client.navigate(urlToOpen);
                        }
                        return;
                    }
                }
                // 없으면 새 창 열기
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

console.log('[SW] Push handler loaded');
