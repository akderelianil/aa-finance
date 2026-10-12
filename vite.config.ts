import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devDb } from './scripts/dev-db.ts'

// Tauri expects a fixed port and does not need the screen cleared.
export default defineConfig({
  plugins: [react(), tailwindcss(), devDb()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: 'es2023' },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src/ui') } },
})
