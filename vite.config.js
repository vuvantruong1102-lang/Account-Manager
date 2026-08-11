import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo-mark.png'],
      manifest: {
        name: 'Yokool B2B CRM',
        short_name: 'Yokool CRM',
        description: 'CRM quản lý khách hàng và báo giá Yokool B2B',
        theme_color: '#dc143b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Luôn ưu tiên bản mới nhất cho trang & tài nguyên; xóa cache cũ ngay khi có bản mới
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // API Supabase (REST, Auth, Realtime): KHÔNG cache — luôn lấy dữ liệu mới,
            // tránh hiện "Chưa có báo giá" do trả cache cũ/rỗng rồi mới cập nhật.
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
