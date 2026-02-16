const CACHE = 'gbc-v8';
const FILES = ['./', 'index.html', 'style.css', 'cpu.js', 'mmu.js', 'ppu.js', 'apu.js', 'timer.js', 'joypad.js', 'mbc.js', 'gameboy.js', 'app.js', 'manifest.json', 'bg.jpg'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
    self.clients.claim();
});

// Network-first strategy: always try fresh, fall back to cache for offline
self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).then(response => {
            // Cache the fresh response
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
            return response;
        }).catch(() => {
            // Offline - serve from cache
            return caches.match(e.request);
        })
    );
});
