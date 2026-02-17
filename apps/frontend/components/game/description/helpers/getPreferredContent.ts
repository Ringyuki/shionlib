import { GameData, GameCover, GameCharacter } from '@/interfaces/game/game.interface'
import { Developer } from '@/interfaces/developer/developer.interface'

export type ContentType = 'cover' | 'title' | 'intro'
type Lang = 'en' | 'jp' | 'zh'

export interface PreferredCover {
  cover: GameCover
  vertical: boolean
  aspect: '1 / 1.5' | '1.5 / 1' | '1 / 1'
}

export interface PreferredIntro {
  intro: string
  language: string
  disable_languages: string[]
}

export interface PreferredTitle {
  title: string
  language: string
  disable_languages: string[]
}

type GameCoverSource = Pick<GameData, 'covers'>
type GameTitleSource = Pick<GameData, 'title_jp' | 'title_zh' | 'title_en'>
type GameIntroSource = Pick<GameData, 'intro_jp' | 'intro_zh' | 'intro_en'>

export function getPreferredContent(
  game: GameCoverSource,
  contentType: 'cover',
  lang: Lang,
): PreferredCover
export function getPreferredContent(
  game: GameTitleSource,
  contentType: 'title',
  lang: Lang,
): PreferredTitle
export function getPreferredContent(
  game: GameIntroSource,
  contentType: 'intro',
  lang: Lang,
): PreferredIntro
export function getPreferredContent(
  game: GameCoverSource | GameTitleSource | GameIntroSource,
  contentType: ContentType,
  lang: Lang,
): PreferredCover | PreferredTitle | PreferredIntro {
  switch (contentType) {
    case 'cover':
      const coverSource = game as GameCoverSource
      const cover =
        coverSource.covers?.find(c => c.language === lang) ??
        (coverSource.covers?.[0]! as GameCover)
      if (!cover) {
        return {
          cover: coverSource.covers?.[0]! as GameCover,
          vertical: false,
          aspect: '1.5 / 1',
        }
      }
      const [w, h] = cover.dims ?? [0, 0]
      const aspect = getAspectRatio([w, h])
      return {
        cover,
        vertical: aspect === '1 / 1.5',
        aspect,
      }
    case 'title':
      const titleSource = game as GameTitleSource
      const title =
        titleSource[`title_${lang}` as keyof GameTitleSource] ||
        titleSource.title_jp ||
        titleSource.title_en ||
        titleSource.title_zh
      return {
        title: title,
        language:
          titleSource[`title_${lang}` as keyof GameTitleSource] === title
            ? lang
            : title === titleSource.title_en
              ? 'en'
              : title === titleSource.title_zh
                ? 'zh'
                : 'jp',
        disable_languages: Object.keys(titleSource)
          .filter(k => k.startsWith('title_') && !titleSource[k as keyof GameTitleSource])
          .map(k => k.replace('title_', '')),
      }
    case 'intro':
      const introSource = game as GameIntroSource
      const intro =
        introSource[`intro_${lang}` as keyof GameIntroSource] ||
        introSource.intro_jp ||
        introSource.intro_en ||
        introSource.intro_zh
      return {
        intro: intro,
        language:
          introSource[`intro_${lang}` as keyof GameIntroSource] === intro
            ? lang
            : intro === introSource.intro_en
              ? 'en'
              : intro === introSource.intro_zh
                ? 'zh'
                : 'jp',
        disable_languages: Object.keys(introSource)
          .filter(k => k.startsWith('intro_') && !introSource[k as keyof GameIntroSource])
          .map(k => k.replace('intro_', '')),
      }
  }
}

export type CharacterContentType = 'name' | 'intro'

export interface PreferredName {
  name: string
  language: string
  disable_languages: string[]
}

export interface PreferredIntro {
  intro: string
  language: string
  disable_languages: string[]
}

export function getPreferredCharacterContent(
  character: GameCharacter,
  contentType: 'name',
  lang: Lang,
): PreferredName
export function getPreferredCharacterContent(
  character: GameCharacter,
  contentType: 'intro',
  lang: Lang,
): PreferredIntro
export function getPreferredCharacterContent(
  character: GameCharacter,
  contentType: CharacterContentType,
  lang: Lang,
): PreferredName | PreferredIntro {
  switch (contentType) {
    case 'name':
      const name =
        (character[`name_${lang}`] as string) ||
        character.name_jp ||
        character.name_en ||
        character.name_zh ||
        ''
      return {
        name: name,
        language:
          character[`name_${lang}`] === name
            ? lang
            : name === character.name_en
              ? 'en'
              : name === character.name_zh
                ? 'zh'
                : 'jp',
        disable_languages: Object.keys(character)
          .filter(k => k.startsWith('name_') && !character[k as keyof GameCharacter])
          .map(k => k.replace('name_', '')),
      }
    case 'intro':
      const intro =
        (character[`intro_${lang}`] as string) ||
        character.intro_jp ||
        character.intro_en ||
        character.intro_zh ||
        ''
      return {
        intro: intro,
        language:
          character[`intro_${lang}`] === intro
            ? lang
            : intro === character.intro_en
              ? 'en'
              : intro === character.intro_zh
                ? 'zh'
                : 'jp',
        disable_languages: Object.keys(character)
          .filter(k => k.startsWith('intro_') && !character[k as keyof GameCharacter])
          .map(k => k.replace('intro_', '')),
      }
  }
}

export function getPreferredDeveloperContent(developer: Developer, lang: Lang): PreferredIntro {
  const intro =
    (developer[`intro_${lang}`] as string) ||
    developer.intro_jp ||
    developer.intro_en ||
    developer.intro_zh ||
    ''
  return {
    intro: intro,
    language:
      developer[`intro_${lang}`] === intro
        ? lang
        : intro === developer.intro_en
          ? 'en'
          : intro === developer.intro_zh
            ? 'zh'
            : 'jp',
    disable_languages: Object.keys(developer)
      .filter(k => k.startsWith('intro_') && !developer[k as keyof Developer])
      .map(k => k.replace('intro_', '')),
  }
}

export function getAspectRatio(dims: [number, number]): '1 / 1' | '1 / 1.5' | '1.5 / 1' {
  const [w, h] = dims ?? [0, 0]
  const ratio = w && h ? w / h : 0
  return !w || !h
    ? '1.5 / 1'
    : Math.abs(ratio - 1) < 0.2
      ? '1 / 1'
      : ratio < 1
        ? '1 / 1.5'
        : '1.5 / 1'
}
