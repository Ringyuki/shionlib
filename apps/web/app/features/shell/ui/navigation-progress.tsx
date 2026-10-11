import { Flex } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useNavigationProgress } from '../use-navigation-progress'

export function NavigationProgress() {
  const t = useTranslations('shell')
  const { phase, settle } = useNavigationProgress()
  return (
    <Flex
      role="progressbar"
      aria-label={t('navigating')}
      aria-hidden={phase !== 'loading'}
      data-phase={phase}
      onTransitionEnd={settle}
      className="navigation-progress bg-accent pointer-events-none fixed inset-x-0 top-0 z-(--hn-z-toast) h-0.5"
    />
  )
}
