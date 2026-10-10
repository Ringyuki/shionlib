import { Result, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { useWritingDesk } from '../use-writing-desk'
import type { Draft } from '../walkthrough'
import { WalkthroughCanvas } from './walkthrough-canvas'

type WalkthroughWritingPageProps = { draft: Draft; signedIn: boolean }

export function WalkthroughWritingPage({ draft, signedIn }: WalkthroughWritingPageProps) {
  const t = useTranslations('walkthrough')
  const desk = useWritingDesk(draft.walkthroughId)
  if (signedIn) {
    return <WalkthroughCanvas key={desk.turn} draft={draft} onCreated={desk.adopt} />
  }
  return (
    <Stack justify="center" className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <Result
        status="info"
        title={t('signIn')}
        actions={<Button loginRequired>{t('signInAction')}</Button>}
      />
    </Stack>
  )
}
