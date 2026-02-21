/**
 * Minimal data interfaces matching the shionlib-backend API response shapes,
 * scoped to the fields needed for OG image generation.
 *
 * NOTE: The internal data fields use 'jp' as the Japanese key (e.g. title_jp),
 * while the public locale code is 'ja'. The DataLang type reflects this distinction.
 * This is a known inconsistency in the existing data model — do not change it here.
 */
import type { DataLang } from '@/config'

// ─── Game ────────────────────────────────────────────────────────────────────

export interface GameCover {
  language: DataLang
  url: string
  dims: number[]
}

export interface GameOgSource {
  title_jp: string
  title_zh: string
  title_en: string
  intro_jp: string
  intro_zh: string
  intro_en: string
  covers?: GameCover[]
}

export type OgAspectRatio = '3:2' | '2:3' | '1:1'

export interface GameOgData {
  title: string
  intro: string
  coverUrl: string | null
  aspectRatio: OgAspectRatio
}

function getAspectRatio(dims: number[]): OgAspectRatio {
  const [w, h] = dims
  if (!w || !h) return '3:2'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.2) return '1:1'
  return ratio < 1 ? '2:3' : '3:2'
}

export function getGameOgData(game: GameOgSource, lang: DataLang): GameOgData {
  const title = game[`title_${lang}`] || game.title_jp || game.title_en || game.title_zh || ''

  const intro = game[`intro_${lang}`] || game.intro_jp || game.intro_en || game.intro_zh || ''

  const cover = game.covers?.find(c => c.language === lang) ?? game.covers?.[0] ?? null

  return {
    title,
    intro,
    coverUrl: cover?.url ?? null,
    aspectRatio: cover?.dims ? getAspectRatio(cover.dims) : '3:2',
  }
}

// ─── Character ───────────────────────────────────────────────────────────────

export interface CharacterOgSource {
  name_jp?: string
  name_zh?: string
  name_en?: string
  intro_jp?: string
  intro_zh?: string
  intro_en?: string
  image?: string
}

export interface CharacterOgData {
  name: string
  intro: string
  imageUrl: string | null
}

export function getCharacterOgData(character: CharacterOgSource, lang: DataLang): CharacterOgData {
  const name =
    character[`name_${lang}`] || character.name_jp || character.name_en || character.name_zh || ''

  const intro =
    character[`intro_${lang}`] ||
    character.intro_jp ||
    character.intro_en ||
    character.intro_zh ||
    ''

  return {
    name,
    intro,
    imageUrl: character.image ?? null,
  }
}

// ─── Developer ───────────────────────────────────────────────────────────────

export interface DeveloperOgSource {
  name: string
  aliases: string[]
  logo?: string
  intro_jp: string
  intro_zh: string
  intro_en: string
}

export interface DeveloperOgData {
  name: string
  intro: string
  logoUrl: string | null
}

export function getDeveloperOgData(developer: DeveloperOgSource, lang: DataLang): DeveloperOgData {
  const intro =
    developer[`intro_${lang}`] ||
    developer.intro_jp ||
    developer.intro_en ||
    developer.intro_zh ||
    ''

  return {
    name: developer.name || developer.aliases[0] || '',
    intro,
    logoUrl: developer.logo ?? null,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise intro text for use as OG description: strip newlines, truncate. */
export function normaliseIntro(intro: string, maxLength = 600): string {
  const cleaned = intro.replace(/[\r\n]+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.slice(0, maxLength)
}
