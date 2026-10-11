import { useLocation } from 'react-router'
import { useLocale } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { resourcePath, resourceTabAt, type ResourceTab } from './resource-page'

export function useResourceTabs(resourceId: number) {
  const locale = useLocale()
  const { pathname } = useLocation()
  const stay = useInPageNavigate()
  const pathOf = (tab: ResourceTab) => resourcePath(locale, resourceId, tab)
  const current = resourceTabAt(pathname, pathOf)
  const select = (tab: ResourceTab) => {
    if (tab !== current) {
      stay(pathOf(tab))
    }
  }
  return { current, select }
}
