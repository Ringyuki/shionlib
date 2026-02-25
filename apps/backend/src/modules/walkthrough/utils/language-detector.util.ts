import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'
import { loadModule } from 'cld3-asm'
import * as OpenCC from 'opencc-js'

export type WalkthroughLanguage = 'en' | 'zh' | 'zh-hant' | 'jp' | 'unknown'

const resultMap = new Map<string, WalkthroughLanguage>()

const HIRAGANA_REGEX = /\p{Script=Hiragana}/gu
const KATAKANA_REGEX = /\p{Script=Katakana}/gu
const HAN_REGEX = /\p{Script=Han}/gu
const LATIN_REGEX = /\p{Script=Latin}/gu
const CN_TO_TW = OpenCC.Converter({ from: 'cn', to: 'tw' })
const TW_TO_CN = OpenCC.Converter({ from: 'tw', to: 'cn' })

let cldIdentifierPromise: Promise<{
  findLanguage: (text: string) => { language: string; probability: number; is_reliable: boolean }
}> | null = null

function countMatches(text: string, regex: RegExp): number {
  return Array.from(text.matchAll(regex)).length
}

function getScriptStats(text: string) {
  const hiraganaCount = countMatches(text, HIRAGANA_REGEX)
  const katakanaCount = countMatches(text, KATAKANA_REGEX)
  const kanaCount = hiraganaCount + katakanaCount
  const hanCount = countMatches(text, HAN_REGEX)
  const latinCount = countMatches(text, LATIN_REGEX)

  return { kanaCount, hanCount, latinCount }
}

function normalizeHanOnly(text: string): string {
  return (text.match(HAN_REGEX) ?? []).join('')
}

function overlapRatio(a: string, b: string): number {
  if (!a || !b) return 0
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0
  let same = 0
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) same += 1
  }
  return same / len
}

function detectChineseVariant(text: string): 'zh' | 'zh-hant' {
  const hanOnly = normalizeHanOnly(text)
  if (!hanOnly) return 'zh'

  const asTraditional = CN_TO_TW(hanOnly)
  const asSimplified = TW_TO_CN(hanOnly)

  const looksTraditional = hanOnly === asTraditional && hanOnly !== asSimplified
  const looksSimplified = hanOnly === asSimplified && hanOnly !== asTraditional

  if (looksTraditional) return 'zh-hant'
  if (looksSimplified) return 'zh'

  const traditionalScore = overlapRatio(hanOnly, asTraditional)
  const simplifiedScore = overlapRatio(hanOnly, asSimplified)

  return traditionalScore > simplifiedScore ? 'zh-hant' : 'zh'
}

function formatLanguageCode(
  languageCode: string,
  stats: { kanaCount: number; hanCount: number; latinCount: number },
  text: string,
): WalkthroughLanguage {
  switch (languageCode) {
    case 'jpn':
      if (stats.hanCount >= 8 && stats.kanaCount < 4) return detectChineseVariant(text)
      return 'jp'
    case 'ja':
      if (stats.hanCount >= 8 && stats.kanaCount < 4) return detectChineseVariant(text)
      return 'jp'
    case 'zho':
    case 'cmn':
    case 'zh':
      return detectChineseVariant(text)
    case 'eng':
    case 'en':
      return 'en'
    default:
      if (stats.hanCount >= 4) return detectChineseVariant(text)
      if (stats.latinCount >= 8) return 'en'
      return 'unknown'
  }
}

async function getCldIdentifier() {
  if (!cldIdentifierPromise) {
    cldIdentifierPromise = loadModule().then(factory => factory.create(0, 1000))
  }
  return cldIdentifierPromise
}

function extractText(node: SerializedLexicalNode): string {
  if ('text' in node && typeof node.text === 'string') return node.text
  if ('children' in node && Array.isArray(node.children)) {
    return (node.children as SerializedLexicalNode[]).map(extractText).join('')
  }
  return ''
}

export function getWalkthroughEditorText(state: SerializedEditorState): string {
  if (!state || typeof state !== 'object' || !('root' in state) || !state.root) return ''
  return extractText(state.root as SerializedLexicalNode)
}

export async function detectWalkthroughLanguage(input: string): Promise<WalkthroughLanguage> {
  const text = input.trim()
  if (!text) return 'unknown'
  if (resultMap.has(text)) return resultMap.get(text)!

  const stats = getScriptStats(text)

  if (stats.kanaCount >= 8 && stats.kanaCount * 3 >= stats.hanCount) {
    resultMap.set(text, 'jp')
    return 'jp'
  }

  if (stats.hanCount >= 8 && stats.kanaCount < 4) {
    const result = detectChineseVariant(text)
    resultMap.set(text, result)
    return result
  }

  if (stats.hanCount === 0 && stats.latinCount >= 8) {
    resultMap.set(text, 'en')
    return 'en'
  }

  const identifier = await getCldIdentifier()
  const cldResult = identifier.findLanguage(text)
  const languageCode = cldResult.language
  const result = formatLanguageCode(languageCode, stats, text)
  resultMap.set(text, result)
  return result
}

export async function detectWalkthroughLanguageFromEditorState(
  state: SerializedEditorState,
  title?: string,
): Promise<WalkthroughLanguage> {
  const contentText = getWalkthroughEditorText(state)
  const combined = [title?.trim(), contentText.trim()].filter(Boolean).join('\n')
  return detectWalkthroughLanguage(combined)
}
