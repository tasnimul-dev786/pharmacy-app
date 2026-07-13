import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ফার্মেসি ম্যানেজার',
        short_name: 'ফার্মেসি',
        description: 'স্টক, সেল ও ইনভয়েস ম্যানেজমেন্ট — অফলাইনেও চলে',
        theme_color: '#1a7f4e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // অফলাইনে যাতে মেডিসিন মাস্টার লিস্টের বড় JSON ফাইলটাও ক্যাশ হয়
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
