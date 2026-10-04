import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.API_INTERNAL_URL ?? 'http://localhost:5000',
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})
