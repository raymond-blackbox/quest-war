import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const versionFile = resolve(currentDir, 'public', 'version.json')
let appVersion = '0.0.0'

try {
  const raw = readFileSync(versionFile, 'utf-8')
  const parsed = JSON.parse(raw)
  if (parsed && typeof parsed.version === 'string') {
    appVersion = parsed.version
  }
} catch (error) {
  appVersion = '0.0.0'
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      workbox: {
        skipWaiting: true,
        clientsClaim: true
      },
      manifest: {
        name: 'Quest War',
        short_name: 'Quest War',
        description: 'Quest War Game',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        display: 'standalone',
        start_url: '/',
        background_color: '#ffffff'
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/database', 'firebase/firestore']
        }
      }
    }
  }
})
