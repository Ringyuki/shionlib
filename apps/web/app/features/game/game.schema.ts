import * as v from 'valibot'
import {
  gameTabs,
  introLanguages,
  platforms,
  resourceRules,
  type GameTab,
  type IntroLanguage,
  type Platform,
  type ResourceRule,
} from './game'
import { firstOrder, reversible, sortKeys, type GameOrder } from './game-order'

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

const platform = v.picklist(platforms)

export function platformFrom(value: unknown): Platform | undefined {
  const parsed = v.safeParse(platform, value)
  return parsed.success ? parsed.output : undefined
}

const resourceRule = v.picklist(resourceRules)

export function resourceRuleFrom(value: unknown): ResourceRule | undefined {
  const parsed = v.safeParse(resourceRule, value)
  return parsed.success ? parsed.output : undefined
}

const sort = v.fallback(v.picklist(sortKeys), firstOrder.sort)

export function orderFrom(params: URLSearchParams): GameOrder {
  const chosen = v.parse(sort, params.get('sort'))
  return { sort: chosen, ascending: params.get('order') === 'asc' && reversible(chosen) }
}
