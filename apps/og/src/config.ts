import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  BACKEND_INTERNAL_URL: z.string().url().default('http://localhost:5000'),

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

/**
 * Rendered cards are held in process, so this is bounded by count rather than
 * time. Cards are ~600-950KB each and PM2 restarts the service at 1G, which is
 * what keeps this well below 512.
 */
export const IMAGE_CACHE_MAX = 256

export type SupportedLocale = 'en' | 'zh' | 'ja'
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'zh', 'ja']

// Internal lang key used in game/character data fields (title_jp, intro_jp …)
export type DataLang = 'en' | 'zh' | 'jp'
export const LOCALE_TO_DATA_LANG: Record<SupportedLocale, DataLang> = {
  en: 'en',
  zh: 'zh',
  ja: 'jp', // data fields use 'jp', not 'ja'
}
