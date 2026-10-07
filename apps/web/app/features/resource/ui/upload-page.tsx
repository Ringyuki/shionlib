import { Heading, Result, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { GameHeader } from '~/features/game'
import type { Allowance } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import { UploadForm } from './upload-form'

type UploadPageProps = {
  game: GameHeader | null
  allowance: Allowance | null
}

export function UploadPage({ game, allowance }: UploadPageProps) {
  const t = useTranslations('resource')
  return (
    <Stack gap="lg" className="mx-auto w-full max-w-2xl">
      <Stack gap="sm">
        <Heading level={1} size="xl" weight="semibold">
          {t('uploadTitle')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('uploadDescription')}
        </Text>
      </Stack>
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
