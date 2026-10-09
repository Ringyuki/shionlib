import { useLocation } from 'react-router'
import { useLocale } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { gamePath, gameTabs, type GameTab } from './game'

export function useGameTabs(gameId: number) {
  const locale = useLocale()
  const { pathname } = useLocation()
  const stay = useInPageNavigate()
  const pathOf = (tab: GameTab) => gamePath(locale, gameId, tab)
  const current = gameTabs.find(tab => pathOf(tab) === pathname) ?? 'resources'
  const select = (tab: GameTab) => {
    if (tab !== current) {
      stay(pathOf(tab))
    }
  }
  return { current, select, pathOf }
}
