import { useLocation, useNavigate } from 'react-router'
import { useLocale } from 'use-intl'
import { keepScroll } from '~/features/shell'
import { profilePath, tabAt, type ProfileTab } from './profile'

export function useProfileTabs(userId: number) {
  const locale = useLocale()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = tabAt(pathname, locale, userId)
  const select = (tab: ProfileTab) => {
    if (tab !== current) {
      void navigate(profilePath(locale, userId, tab), {
        state: keepScroll,
        preventScrollReset: true,
      })
    }
  }
  return { current, select }
}
