import { cn, Inline, Stack, Tag, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { titleOf, TwoLines } from '~/features/admin'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { ScanCase } from '../admin-check'
import { outcomeFrom } from '../admin-check.schema'

export const fileWidth = 280

export const userWidth = 140

type FileCellProps = {
  name: string
  size: number
  game?: Parameters<typeof titleOf>[0]
  narrow?: ReactNode
}

export function FileCell({ name, size, game, narrow }: FileCellProps) {
  const t = useTranslations('adminCheck')
  const bytes = useBytes('short')
  const title = game === undefined ? '' : titleOf(game)
  return (
    <TwoLines
      first={name}
      second={title === '' ? bytes(size) : t('fileFacts', { size: bytes(size), game: title })}
      narrow={narrow}
    />
  )
}

type DetectionsProps = {
  names: readonly string[]
  wrap?: boolean
}

export function Detections({ names, wrap = true }: DetectionsProps) {
  return (
    <Stack gap="none">
      {names.map(name => (
        <Text
          key={name}
          as="span"
          size="sm"
          tone="danger"
          className={cn('font-mono', wrap ? 'break-all' : 'whitespace-nowrap')}
        >
          {name}
        </Text>
      ))}
    </Stack>
  )
}

const tones = {
  ADMIN_ALLOW: 'success',
  ADMIN_DELETE: 'danger',
  TIMEOUT_AUTO_DELETE: 'neutral',
} as const

export function OutcomeTag({ scanCase }: { scanCase: Pick<ScanCase, 'decision_source'> }) {
  const t = useTranslations('adminCheck.outcome')
  const outcome = outcomeFrom(scanCase.decision_source)
  return outcome === undefined ? (
    <Tag tone="warning">{t('PENDING')}</Tag>
  ) : (
    <Tag tone={tones[outcome]}>{t(outcome)}</Tag>
  )
}

export function RowActions({ children }: { children: ReactNode }) {
  return (
    <Inline gap="xs" justify="end" wrap={false} onClick={event => event.stopPropagation()}>
      {children}
    </Inline>
  )
}
