// Prefer Unicode script property escapes when available (covers astral planes like Ext-B~F)
let cjkRegex: RegExp
try {
  cjkRegex = new RegExp(
    '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]',
    'u',
  )
} catch {
  // Fallback for environments without Unicode property escapes
  // Includes: Hiragana, Katakana (incl. Phonetic Extensions), CJK punct, Fullwidth forms,
  // CJK Unified Ideographs + Ext-A, Compatibility Ideographs, Hangul syllables + Jamo
  cjkRegex =
    /[\u3040-\u30FF\u31F0-\u31FF\u3000-\u303F\uFF00-\uFFEF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/
}

export const isCJK = (text: string) => {
  if (!text) return false
  return cjkRegex.test(text)
}
