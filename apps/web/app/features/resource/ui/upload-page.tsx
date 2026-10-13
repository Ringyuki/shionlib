import { Link, PageHeader, Result, SegmentedControl, Stack, Text } from '@hina-ui/react'
import { Link as RouterLink, useSearchParams } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import type { GameHeader } from '~/features/game'
import { sitePaths } from '~/features/shell'
import type { Allowance } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import { composeModes, type ComposeMode, type Composer } from '../resource-composition'
import { CompositionWizard } from './composition-wizard'
import { UploadForm } from './upload-form'

type UploadPageProps = {
  game: GameHeader | null
  allowance: Allowance | null
  mode: ComposeMode
  composer: Composer | null
}

const widths = { upload: 'mx-auto w-full max-w-2xl', compose: 'w-full max-w-6xl' } as const

export function UploadPage({ game, allowance, mode, composer }: UploadPageProps) {
  const t = useTranslations('resource')
  const locale = useLocale()
  const [, setSearchParams] = useSearchParams()
  const switchTo = (next: ComposeMode) => {
    const params = new URLSearchParams()
    if (next === 'compose') {
      params.set('mode', next)
    }
    if (game !== null) {
      params.set('game', String(game.id))
    }
    setSearchParams(params)
  }
  return (
    <Stack gap="lg" className={widths[mode]}>
      <PageHeader title={t('uploadTitle')}>
        {mode === 'upload' && (
          <Text tone="muted">
            {t.rich('uploadDescription', {
              uploads: chunks => (
                <Link asChild>
                  <RouterLink to={sitePaths(locale).uploads}>{chunks}</RouterLink>
                </Link>
              ),
            })}
          </Text>
        )}
      </PageHeader>
      <SegmentedControl
        size="sm"
        aria-label={t('uploadTitle')}
        className="self-start"
        options={composeModes.map(value => ({ value, label: t(`composition.mode.${value}`) }))}
        value={mode}
        onValueChange={value => switchTo(value === 'compose' ? 'compose' : 'upload')}
      />
      {allowance === null ? (
        <Result
          status="info"
          title={t(mode === 'compose' ? 'composition.signIn' : 'uploadSignIn')}
          actions={<Button loginRequired>{t('signIn')}</Button>}
        />
      ) : mode === 'compose' && composer !== null ? (
        <CompositionWizard
          key={composer.composition?.id ?? 'new'}
          game={game}
          allowance={allowance}
          composer={composer}
        />
      ) : (
        <UploadForm game={game} allowance={allowance} />
      )}
    </Stack>
  )
}
