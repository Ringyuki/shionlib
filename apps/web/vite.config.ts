import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [svgr({ svgrOptions: { dimensions: false } }), tailwindcss(), reactRouter()],
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
