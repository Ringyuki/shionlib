import { createTranslator } from 'use-intl/core'
import { gamePath, gameTitle } from '~/features/game'
import { bbcodePlainText } from '~/shared/markup/bbcode'
import { clipped, shareImage, type HeadTexts, type PageHead } from '~/shared/seo/seo'
import { breadcrumbs } from '~/shared/seo/structured-data'
import { characterName, characterPath, type CharacterContent } from './character'

const introOrder = {
  zh: ['intro_zh', 'intro_jp', 'intro_en'],
  en: ['intro_en', 'intro_jp', 'intro_zh'],
  ja: ['intro_jp', 'intro_zh', 'intro_en'],
} as const

export function characterHead({ character, works }: CharacterContent, texts: HeadTexts): PageHead {
  const { locale, messages } = texts
  const t = createTranslator({ locale, messages, namespace: 'character.seo' })
  const name = characterName(character, locale)
  const original = character.name_jp.trim()
  const named = original !== '' && original !== name ? t('named', { name, original }) : name
  const [appearance] = character.appearances ?? []
  const game =
    works.games.find(work => work.id === appearance?.game_id) ?? works.games.at(0) ?? undefined
  const title =
    game === undefined ? named : t('titled', { name: named, game: gameTitle(game, locale) })
  const actor = appearance?.actor?.trim() ?? ''
  const lead =
    game === undefined
      ? ''
      : actor === ''
        ? t('lead', { name, game: gameTitle(game, locale) })
        : t('voiced', { name, game: gameTitle(game, locale), actor })
  const intro = introOrder[locale].map(key => character[key].trim()).find(text => text !== '') ?? ''
  return {
    title,
    description: clipped(lead + bbcodePlainText(intro)),
    image: shareImage(`/character/${character.id}`, name),
    structured: at => [
      breadcrumbs(at, [
        ...(game === undefined
          ? []
          : [{ name: gameTitle(game, locale), path: gamePath(locale, game.id) }]),
        { name, path: characterPath(locale, character.id) },
      ]),
    ],
  }
}
