import * as v from 'valibot'
import { gameTabs, introLanguages, type GameTab, type IntroLanguage } from './game'

export const viewCommand = v.object({
  gameId: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
})

export type View = v.InferOutput<typeof viewCommand>

const introLanguage = v.picklist(introLanguages)

export function introLanguageFrom(value: unknown): IntroLanguage | undefined {
  const parsed = v.safeParse(introLanguage, value)
  return parsed.success ? parsed.output : undefined
}

const gameTab = v.picklist(gameTabs)

export function gameTabFrom(value: unknown): GameTab | undefined {
  const parsed = v.safeParse(gameTab, value)
  return parsed.success ? parsed.output : undefined
}
