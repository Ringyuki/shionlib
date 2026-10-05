import { useLocation, useNavigate } from 'react-router'
import { useLocale } from 'use-intl'
import { keepScroll } from '~/features/shell'
import { gamePath, gameTabs, type GameTab } from './game'

export function useGameTabs(gameId: number) {
  const locale = useLocale()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pathOf = (tab: GameTab) => gamePath(locale, gameId, tab)
  const current = gameTabs.find(tab => pathOf(tab) === pathname) ?? 'resources'
  const select = (tab: GameTab) => {
    if (tab !== current) {
      void navigate(pathOf(tab), { state: keepScroll, preventScrollReset: true })
    }
  }
  return { current, select, pathOf }
}
