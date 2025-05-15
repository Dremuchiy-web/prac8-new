const CACHE_NAME = 'tasks-app-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './sw-register.js',
    './manifest.json',
    './icons/icon-16x16.png',
    './icons/icon-32x32.png',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    './icons/splash-512x512.png'
];

// установка Service Worker и кэширование ресурсов
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// активация и очистка старых кэшей
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key)))
        }).then(() => self.clients.claim())
    );
});

// перехват запросов и возврат из кэша
self.addEventListener('fetch', event => {
   event.respondWith(
       caches.match(event.request)
           .then(response => {
               if (response) {
                   return response;
               }
               
               return fetch(event.request)
                   .then(networkResponse => {
                       if (networkResponse && networkResponse.status === 200) {
                           const responseToCache = networkResponse.clone();
                           caches.open(CACHE_NAME)
                               .then(cache => {
                                   cache.put(event.request, responseToCache);
                               });
                       }
                       return networkResponse;
                   })
                   .catch(() => {
                       if (event.request.mode === 'navigate') {
                           return caches.match('./index.html');
                       }
                       return new Response('Нет соединения с сетью', {
                           status: 503,
                           headers: { 'Content-Type': 'text/plain' }
                       });
                   });
           })
   );
});

// обработка Push-уведомлений
self.addEventListener('push', event => {
    let notificationData = {};

    if (event.data) {
        try {
            notificationData = event.data.json();
        } catch (e) {
            notificationData = {
                title: 'Новое уведомление',
                body: event.data.text()
            };
        }
    } else {
        notificationData = {
            title: 'Новое уведомление',
            body: 'Получено новое уведомление'
        };
    }

    const options = {
        body: notificationData.body || 'Получено новое уведомление',
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-32x32.png',
        data: {
            url: notificationData.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(
            notificationData.title || 'Умный список задач',
            options
        )
    );
});

// обработка событий при клике на уведомление
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(clientList => {
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
}); 