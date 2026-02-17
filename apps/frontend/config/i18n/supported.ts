// prettier-ignore
export const supportedLocales = [
  'en',
  'zh',
  'ja'
]

// prettier-ignore
export type SupportedLocales =
| 'en'
| 'zh'
| 'ja'

export const supportedLocalesEnum = {
  EN: 'en',
  ZH: 'zh',
  JA: 'ja',
} satisfies Record<'EN' | 'ZH' | 'JA', SupportedLocales>
