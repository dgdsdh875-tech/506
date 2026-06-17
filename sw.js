const CACHE_NAME = 'pos-offline-v2';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// تنصيب الكاش الأولي
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

// تفعيل وتحديث الكاش القديم
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// الاستماع لرسالة التحديث الفوري
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// جلب الملفات من الكاش عند عدم وجود إنترنت (Offline Mode)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            // إذا كان الملف موجود بالكاش أرسله
            if (response) return response;
            
            // إذا لم يكن موجوداً قم بتحميله من الشبكة وحفظه ديناميكياً (كالأيقونات الإضافية)
            return fetch(event.request).then(networkResponse => {
                if (event.request.url.startsWith('http')) {
                    let responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            console.error('Offline mode completely active, resource not found.');
        })
    );
});
