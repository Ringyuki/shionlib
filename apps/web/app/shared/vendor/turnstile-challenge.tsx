import { Stack } from '@hina-ui/react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useLocale } from 'use-intl'
import { usePublicConfig } from '~/shared/config/public-config'
import { htmlLangs } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { useTheme } from '~/shared/ui/theme-provider'
import { loadTurnstile, type TurnstileFailure } from './turnstile'

type TurnstileChallengeProps = {
  action: string
  onToken: (token: string) => void
  onFailure: (failure: TurnstileFailure) => void
  className?: string
}

export function TurnstileChallenge({
  action,
  onToken,
  onFailure,
  className,
}: TurnstileChallengeProps) {
  const { turnstileSiteKey } = usePublicConfig()
  const locale = useLocale()
  const { preference } = useTheme()
  const container = useRef<HTMLElement>(null)
  const pass = useEffectEvent(onToken)
  const fail = useEffectEvent(onFailure)
  const language = isLocale(locale) ? htmlLangs[locale].toLowerCase() : 'auto'
  const theme = preference === 'system' ? 'auto' : preference

  useEffect(() => {
    if (turnstileSiteKey === '') {
      fail('unavailable')
      return
    }
    let cancelled = false
    let widget: string | undefined
    loadTurnstile().then(
      api => {
        if (cancelled || container.current === null) {
          return
        }
        widget = api.render(container.current, {
          sitekey: turnstileSiteKey,
          action,
          theme,
          language,
          appearance: 'interaction-only',
          retry: 'auto',
          callback: token => pass(token),
          'error-callback': () => {
            fail('error')
            return true
          },
          'expired-callback': () => fail('expired'),
          'timeout-callback': () => fail('timeout'),
        })
      },
      () => fail('unavailable'),
    )
    return () => {
      cancelled = true
      if (widget !== undefined) {
        window.turnstile?.remove(widget)
      }
    }
  }, [turnstileSiteKey, action, theme, language])

  return <Stack ref={container} className={className} />
}
