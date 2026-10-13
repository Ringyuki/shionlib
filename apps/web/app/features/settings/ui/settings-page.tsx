import { Grid, PageHeader, Result, Stack } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { SectionNav } from './section-nav'

type SettingsPageProps = {
  signedIn: boolean
  children: ReactNode
}

export function SettingsPage({ signedIn, children }: SettingsPageProps) {
  const t = useTranslations('settings')
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      {signedIn ? (
        <Grid className="items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
          <SectionNav />
          <Stack gap="lg" className="min-w-0">
            {children}
          </Stack>
        </Grid>
      ) : (
        <Result
          status="info"
          title={t('signIn')}
          actions={<Button loginRequired>{t('signInAction')}</Button>}
        />
      )}
    </Stack>
  )
}
