import mdx from '@mdx-js/rollup'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import { buildTarget } from './browsers.ts'
import { mdxOptions } from './mdx/options.ts'

export default defineConfig({
  build: {
    target: buildTarget,
  },
  plugins: [
    svgr({ svgrOptions: { dimensions: false } }),
    tailwindcss(),
    mdx(mdxOptions),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.API_INTERNAL_URL ?? 'http://localhost:5000',
        rewrite: path => path.replace(/^\/api/, ''),
      },
      '/cap': {
        target: process.env.CAP_URL ?? 'http://localhost:5850',
        rewrite: path => path.replace(/^\/cap/, ''),
      },
    },
  },
})
