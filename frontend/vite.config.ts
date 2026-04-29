import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

import { APP_NAME, APP_SHORT_NAME } from './src/config/app'
import {
  PWA_CASHIER_SHORTCUTS,
  PWA_DEV_OPTIONS,
  PWA_ICONS,
  PWA_WORKBOX_OPTIONS,
} from './src/config/pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:5000'
  const devHost = env.VITE_DEV_HOST?.trim() || '127.0.0.1'
  const devPort = Number.parseInt(env.VITE_DEV_PORT || '', 10)
  const resolvedDevPort = Number.isNaN(devPort) ? 5173 : devPort
  const htmlEntries = {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
  }

  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: APP_NAME,
          short_name: APP_SHORT_NAME,
          description: 'Учет льготного питания и выдача по талонам',
          lang: 'ru',
          theme_color: '#1d4ed8',
          background_color: '#eef4ff',
          display: 'standalone',
          start_url: '/',
          shortcuts: PWA_CASHIER_SHORTCUTS,
          icons: PWA_ICONS,
        },
        workbox: PWA_WORKBOX_OPTIONS,
        devOptions: PWA_DEV_OPTIONS,
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        input: htmlEntries,
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return
            }

            if (id.includes('primevue') || id.includes('primeicons')) {
              return 'primevue'
            }

            if (
              id.includes('/vue/') ||
              id.includes('@vue/') ||
              id.includes('vue-router') ||
              id.includes('pinia')
            ) {
              return 'vue-core'
            }

            if (id.includes('@vueuse/')) {
              return 'vueuse'
            }

            return 'vendor'
          },
        },
      },
    },
    server: {
      host: devHost,
      port: resolvedDevPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: devHost,
      port: resolvedDevPort,
      strictPort: true,
    },
  }
})
