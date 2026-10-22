import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 상대 경로: GitHub Pages 같은 하위 경로 배포에서도 동작
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '류소 옷장',
        short_name: '류소옷장',
        description: '종이인형처럼 옷을 갈아입히는 치비 코디 놀이',
        lang: 'ko',
        theme_color: '#ffe9ef',
        background_color: '#fff7f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // 앱 코드만 설치 때 한꺼번에 받는다 (그림 18MB 는 쓸 때 받아서 저장: 업데이트·새로고침이 가볍다)
        globPatterns: ['**/*.{js,css,html,json}', 'icons/*.png', 'assets/sfx/*.mp3'],
        // 마을 배경 음악(1.1MB)은 설치 때 받지 않고 처음 들을 때 받아서 저장한다
        globIgnores: ['assets/sfx/walk.mp3'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /assets\/sfx\/walk\.mp3$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'ryuso-music', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // 그림은 인터넷이 되면 항상 최신으로 받고(3초 안에 못 받으면 저장해 둔 것), 오프라인에서는 저장해 둔 것을 쓴다
            urlPattern: ({ url }) => /\.(?:webp|png|svg|jpg)$/i.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ryuso-images',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
