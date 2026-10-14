import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  BACKEND_INTERNAL_URL: z.string().url().default('http://localhost:5000'),
  SHIONLIB_IMAGE_BED_URL: z.string().url().default('https://t.shionlib.com'),
  OG_CACHE_DISABLED: z
    .enum(['true', 'false', '1', '0'])
    .transform(v => v === 'true' || v === '1')
    .default(true),
})

export const config = schema.parse(process.env)

export const OG_W = 1200
export const OG_H = 630

export const IMAGE_CACHE_MAX = 256

export const IMAGE_CACHE_TTL_MS = 60 * 60 * 1000

export type Locale = 'zh' | 'en' | 'ja'
export const LOCALES: Locale[] = ['zh', 'en', 'ja']
