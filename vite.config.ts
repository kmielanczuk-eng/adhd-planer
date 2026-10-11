import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serwuje apkę pod /adhd-planer/
const base = process.env.VITE_BASE ?? '/adhd-planer/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,mp3}'],
      },
      devOptions: { enabled: false, type: 'module' },
      manifest: {
        name: 'Ogarniacz — planer dla głowy z ADHD',
        short_name: 'Ogarniacz',
        description: 'Prywatny planer, to-do i notatnik przyjazny ADHD.',
        lang: 'pl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f4ef',
        theme_color: '#5b8a72',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Zrzut myśli', short_name: 'Zrzut', url: base + '#/inbox?dump=1' },
          { name: 'Co teraz?', short_name: 'Teraz', url: base + '#/teraz' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
