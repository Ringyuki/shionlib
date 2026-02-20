import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  BACKEND_INTERNAL_URL: z.string().url().default('http://localhost:5000'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_DB: z.coerce.number().default(2),
  REDIS_PASSWORD: z.string().optional(),
  SHIONLIB_IMAGE_BED_URL: z
    .string()
    .url()
    .default(process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL ?? 'https://t.shionlib.com'),

  OG_DESIGN_VERSION: z.string().default('1'),

  OG_CACHE_DISABLED: z
    .enum(['true', 'false', '1', '0'])
    .transform(v => v === 'true' || v === '1')
    .default(true),
})

export const config = schema.parse(process.env)

export const OG_W = 1200
export const OG_H = 630
export const CACHE_TTL = 43200 // 12 hours

export type SupportedLocale = 'en' | 'zh' | 'ja'
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'zh', 'ja']

// Internal lang key used in game/character data fields (title_jp, intro_jp …)
export type DataLang = 'en' | 'zh' | 'jp'
export const LOCALE_TO_DATA_LANG: Record<SupportedLocale, DataLang> = {
  en: 'en',
  zh: 'zh',
  ja: 'jp', // data fields use 'jp', not 'ja'
}
