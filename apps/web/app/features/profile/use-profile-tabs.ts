import { useLocation } from 'react-router'
import { useLocale } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { profilePath, shownTabs, tabAt, type Profile, type ProfileTab } from './profile'

export function useProfileTabs(profile: Profile, own: boolean) {
  const locale = useLocale()
  const { pathname } = useLocation()
  const stay = useInPageNavigate()
  const current = tabAt(pathname, locale, profile.id)
  const select = (tab: ProfileTab) => {
    if (tab !== current) {
      stay(profilePath(locale, profile.id, tab))
    }
  }
  return { current, shown: shownTabs(profile, own, current), select }
}
