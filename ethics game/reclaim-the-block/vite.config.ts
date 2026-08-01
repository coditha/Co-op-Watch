import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://coditha.github.io/Flock/ on GitHub Pages
  base: base: '/Co-op-Watch/',
  plugins: [react()],
})
