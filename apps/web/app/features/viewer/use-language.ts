import { useLocation, useNavigate } from 'react-router'
import { useLocale } from 'use-intl'
import type { Locale } from '~/shared/i18n/locale'
import { switchLocale } from '~/shared/i18n/locale.schema'
import { useAuthGate } from '~/shared/ui/auth-gate'
import { usePreferences } from './use-preferences'

export function useLanguage() {
  const current = useLocale()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const gate = useAuthGate()
  const preferences = usePreferences()
  const change = (locale: Locale) => {
    if (locale === current) {
      return
    }
    if (gate.signedIn) {
      void preferences.save({ lang: locale })
    }
    void navigate(`${switchLocale(pathname, locale)}${search}`)
  }
  return { current, change }
}
