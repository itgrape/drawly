import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const appDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(appDirectory, '../../dist/web'),
    emptyOutDir: true,
  },
  server: {
    port: 5757,
  },
  optimizeDeps: {
    exclude: ['@tldraw/assets'],
  },
})
