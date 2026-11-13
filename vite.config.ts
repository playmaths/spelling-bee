import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Writes sw.js at build time. Same approach as Number Garden and Sudoku: fetch
 * fresh when online so updates arrive, fall back to the cache when offline.
 * Everything the app needs is cached on install, so it works offline after one visit.
 */
function serviceWorker(): Plugin {
  return {
    name: 'spelling-bee-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/'))
        .sort()
      const files = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg', ...built.map((f) => `./${f}`)]
      let hash = 0
      for (const ch of built.join()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
      const source = `/* offline: keep the app cached; fetch fresh when online so updates arrive, fall back to the cache when not */
const CACHE='spelling-bee-${hash.toString(36)}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('spelling-bee-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=new URL(e.request.url);if(url.origin!==location.origin)return;
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true,ignoreVary:true}).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html',{ignoreVary:true}):Response.error()))))});
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/spelling-bee/',
  plugins: [react(), tailwindcss(), serviceWorker()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
