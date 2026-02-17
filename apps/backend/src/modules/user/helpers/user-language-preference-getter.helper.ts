import { Lang } from '../../../shared/types/i18n/lang.types'

const SUPPORTED: Lang[] = ['zh', 'ja', 'en']

/**
 * Parse Accept-Language header and pick from ['zh','ja','en']
 * fallback to 'en'
 */
export function getPreferredLang(acceptLanguage?: string | null): Lang {
  if (!acceptLanguage || !acceptLanguage.trim()) return 'en'

  // ex: "zh-CN;q=0.9, ja-JP;q=0.8, en-US;q=0.7, *;q=0.5"
  // split by comma while trimming spaces
  const items = acceptLanguage
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  type Entry = { tag: string; base: string; q: number; index: number }

  const parsed: Entry[] = []

  const re =
    /^([A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})?)(?:\s*;\s*q\s*=\s*(1(?:\.0{0,3})?|0(?:\.\d{0,3})?))?$/

  items.forEach((item, index) => {
    const m = re.exec(item)
    if (!m) return

    const tagRaw = m[1].toLowerCase()
    const q = m[2] !== undefined ? Math.max(0, Math.min(1, Number(m[2]))) : 1

    // wildcard '*' handled by base='*'
    const base = tagRaw === '*' ? '*' : tagRaw.split('-')[0]

    parsed.push({ tag: tagRaw, base, q, index })
  })

  if (parsed.length === 0) return 'en'

  // sort by q desc, then by original order
  parsed.sort((a, b) => b.q - a.q || a.index - b.index)

  // pick the first supported language by base
  for (const { base } of parsed) {
    if (SUPPORTED.includes(base as Lang)) return base as Lang
  }

  // if only wildcard(s) or unsupported languages present, fallback
  return 'en'
}
