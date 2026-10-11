import { Panel } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import type { Viewer } from '~/features/viewer'
import { Button } from '~/shared/ui/button'
import { NamePanel } from './name-panel'

export function PersonalSection({ viewer }: { viewer: Viewer }) {
  const t = useTranslations('settings.personal')
  const locale = useLocale()
  return (
    <>
      <NamePanel key={viewer.name} current={viewer.name} />
      <Panel title={t('profile')} description={t('profileHint')}>
        <Button asChild variant="outline" tone="neutral">
          <Link to={profilePath(locale, viewer.id)}>{t('openProfile')}</Link>
        </Button>
      </Panel>
    </>
  )
}
