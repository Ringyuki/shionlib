import { Card, Divider, Inline, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { GameCover, gameTitle, originalTitle, type GameHeader } from '~/features/game'
import type { Allowance } from '~/features/upload'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { CompositionBase, Composition, InputPhase } from '../resource-composition'
import { StorageMeter } from './storage-meter'

type CompositionSummaryProps = {
  game: GameHeader | null
  allowance: Allowance
  base: CompositionBase | undefined
  composition: Composition | null
  patch: InputPhase
  last: boolean
  keepPatch: boolean
}

export function CompositionSummary(props: CompositionSummaryProps) {
  const { game, allowance, base, composition, patch, last, keepPatch } = props
  const t = useTranslations('resource.composition')
  const bytes = useBytes()
  const locale = useLocale()
  const patchSize = 'input' in patch ? patch.input.size : composition?.patch?.size
  const note =
    patch.name === 'uploading'
      ? t('input.uploading', { percent: patch.percent })
      : patch.name === 'reading'
        ? t('input.reading')
        : undefined
  const estimate = composition?.estimated_size ?? 0
  return (
    <Card as="aside" aria-label={t('summary.label')}>
      <Stack gap="md">
        {game !== null && (
          <>
            <Inline gap="md" align="center" wrap={false}>
              <GameCover game={game} className="w-10 shrink-0 rounded-md" />
              <Stack gap="none" className="min-w-0">
                <Text weight="medium" truncate>
                  {gameTitle(game, locale)}
                </Text>
                <Text size="sm" tone="muted" truncate>
                  {originalTitle(game, locale)}
                </Text>
              </Stack>
            </Inline>
            <Divider />
          </>
        )}
        <Row term={t('summary.base')}>{base === undefined ? undefined : bytes(base.size)}</Row>
        <Row term={t('summary.patch')} note={note} empty={t('summary.unsent')}>
          {patchSize === undefined ? undefined : bytes(patchSize)}
        </Row>
        <Row term={t('summary.save')}>
          {composition?.save === null || composition?.save === undefined
            ? undefined
            : bytes(composition.save.size)}
        </Row>
        {last && (
          <Row term={t('summary.keepPatch')}>
            {t(keepPatch ? 'summary.kept' : 'summary.dropped')}
          </Row>
        )}
        <Divider />
        {last && (
          <Inline gap="md" align="baseline" justify="between" wrap={false}>
            <Text size="sm" tone="muted">
              {t('summary.size')}
            </Text>
            <Text size="xl" weight="semibold" className="tabular-nums">
              {t('summary.estimate', { size: bytes(estimate) })}
            </Text>
          </Inline>
        )}
        {allowance.stored_limit !== null && (
          <StorageMeter
            limit={allowance.stored_limit}
            stored={allowance.stored}
            uploading={allowance.in_flight}
            chosen={last ? estimate : 0}
          />
        )}
      </Stack>
    </Card>
  )
}

type RowProps = { term: string; note?: string; empty?: string; children: ReactNode }

function Row({ term, note, empty, children }: RowProps) {
  const t = useTranslations('resource.composition.summary')
  return (
    <Inline gap="md" align="start" justify="between" wrap={false}>
      <Text size="sm">{term}</Text>
      <Stack gap="none" className="items-end text-end">
        <Text
          size="sm"
          weight="medium"
          tone={children === undefined ? 'faint' : undefined}
          className="tabular-nums"
        >
          {children ?? empty ?? t('unchosen')}
        </Text>
        {note !== undefined && (
          <Text size="sm" tone="muted" className="tabular-nums">
            {note}
          </Text>
        )}
      </Stack>
    </Inline>
  )
}
