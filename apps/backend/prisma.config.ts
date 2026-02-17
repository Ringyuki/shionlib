import path from 'node:path'
import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  schema: path.join('prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
})
