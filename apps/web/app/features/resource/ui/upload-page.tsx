import { Link, PageHeader, Result, Stack, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import type { GameHeader } from '~/features/game'
import { sitePaths } from '~/features/shell'
import type { Allowance } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import { UploadForm } from './upload-form'

type UploadPageProps = {
  game: GameHeader | null
  allowance: Allowance | null
}

export function UploadPage({ game, allowance }: UploadPageProps) {
  const t = useTranslations('resource')
  const locale = useLocale()
  return (
    <Stack gap="lg" className="mx-auto w-full max-w-2xl">
      <PageHeader title={t('uploadTitle')}>
        <Text tone="muted">
          {t.rich('uploadDescription', {
            uploads: chunks => (
              <Link asChild>
                <RouterLink to={sitePaths(locale).uploads}>{chunks}</RouterLink>
              </Link>
            ),
          })}
        </Text>
      </PageHeader>
      {allowance === null ? (
        <Result
          status="info"
          title={t('uploadSignIn')}
          actions={<Button loginRequired>{t('signIn')}</Button>}
        />
      ) : (
        <UploadForm game={game} allowance={allowance} />
      )}
    </Stack>
  )
}
