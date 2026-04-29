/* Block Writing Service Worker
 * 정적 파일은 캐싱해서 빠르게 로드.
 * Supabase API는 항상 최신 데이터를 받기 위해 캐싱하지 않음.
 */

const CACHE_NAME = 'block-writing-v1';
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* 설치 시 정적 파일 캐싱 */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_FILES);
    }).catch(function(err) {
      console.log('Cache install failed:', err);
    })
  );
  self.skipWaiting();
});

/* 활성화 시 옛 캐시 정리 */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

/* 요청 가로채기 */
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  /* Supabase API는 캐싱하지 않고 그대로 통과 */
  if (url.indexOf('supabase.co') !== -1) {
    return;
  }

  /* GET이 아닌 요청은 캐싱하지 않음 */
  if (event.request.method !== 'GET') {
    return;
  }

  /* 네트워크 우선, 실패 시 캐시 fallback */
  event.respondWith(
    fetch(event.request).then(function(response) {
      /* 정상 응답이면 정적 파일만 캐시에 업데이트 */
      if (response && response.ok) {
        var isStatic = url.endsWith('.html') ||
                       url.endsWith('.png') ||
                       url.endsWith('.json') ||
                       url.endsWith('.js') ||
                       url.endsWith('.css') ||
                       url.endsWith('/');
        if (isStatic) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
      }
      return response;
    }).catch(function() {
      /* 네트워크 실패 시 캐시에서 찾기 */
      return caches.match(event.request);
    })
  );
});
