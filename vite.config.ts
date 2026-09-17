import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: { 'import.meta.env.APP_COMMIT': JSON.stringify(process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? 'local') },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '拾页',
        short_name: '拾页',
        description: '离线可用的个人读书与生活摘记工具',
        theme_color: '#f5f6f3',
        background_color: '#f5f6f3',
        display: 'standalone',
        start_url: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: /\/api\//, method: 'GET', handler: 'NetworkOnly' },
          { urlPattern: /\/api\//, method: 'POST', handler: 'NetworkOnly' },
          { urlPattern: /\/api\//, method: 'PUT', handler: 'NetworkOnly' },
          { urlPattern: /\/api\//, method: 'PATCH', handler: 'NetworkOnly' },
          { urlPattern: /\/api\//, method: 'DELETE', handler: 'NetworkOnly' }
        ],
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      },
      devOptions: { enabled: false }
    })
  ]
})
