import { PageHeader, Result, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { Writing } from '../walkthrough.use-cases'
import { WritingDesk } from './writing-desk'

type WritingPageProps = { writing: Writing; signedIn: boolean }

export function WritingPage({ writing, signedIn }: WritingPageProps) {
  const t = useTranslations('walkthrough')
  if (!signedIn) {
    return (
      <Stack gap="lg">
        <PageHeader title={t('writeTitle')} />
        <Result
          status="info"
          title={t('signIn')}
          actions={<Button loginRequired>{t('signInAction')}</Button>}
        />
      </Stack>
    )
  }
  return <WritingDesk writing={writing} />
}
