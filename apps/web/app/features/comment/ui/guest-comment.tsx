import { Avatar, Card, cn, Inline, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useAuthGate } from '~/shared/ui/auth-gate'
import { fieldEdge, textArea } from './composer-field'

export function GuestComment({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useTranslations('comment')
  const gate = useAuthGate()
  return (
    <Inline gap="md" align="center" wrap={false}>
      <Avatar className="shrink-0 sm:size-9" />
      <Card
        as="button"
        padded={false}
        aria-label={t('field')}
        className={cn('hn-interactive hn-prose min-w-0 flex-1 cursor-text text-start', fieldEdge)}
        onClick={() => gate.requireSignIn(onSignedIn)}
      >
        <Text as="span" size="inherit" tone="faint" className={cn('block', textArea(true, false))}>
          {t('hint')}
        </Text>
      </Card>
    </Inline>
  )
}
