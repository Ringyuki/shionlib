import { Stack, Tag, Text, Time } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import {
  ModerationVerdict,
  RecordTable,
  TwoLines,
  UserRef,
  titleOf,
  type Paging,
  type RecordColumn,
} from '~/features/admin'
import { languageOf, type Walkthrough } from '../admin-walkthrough'

type WalkthroughTableProps = {
  walkthroughs: Walkthrough[]
  paging: Paging
  filtered: boolean
  onOpen: (walkthrough: Walkthrough) => void
}

const tones = {
  PUBLISHED: 'success',
  HIDDEN: 'neutral',
  DRAFT: 'neutral',
  DELETED: 'danger',
} as const

export function StatusTags({ walkthrough }: { walkthrough: Pick<Walkthrough, 'status' | 'held'> }) {
  const t = useTranslations('adminWalkthrough.status')
  return (
    <Stack gap="xs" align="start">
      <Tag tone={tones[walkthrough.status]}>{t(walkthrough.status)}</Tag>
      {walkthrough.held && <Tag tone="warning">{t('HELD')}</Tag>}
    </Stack>
  )
}

export function WalkthroughTable({
  walkthroughs,
  paging,
  filtered,
  onOpen,
}: WalkthroughTableProps) {
  const t = useTranslations('adminWalkthrough')
  const shared = useTranslations('admin')
  const columns: RecordColumn[] = [
    { key: 'walkthrough', label: t('column.walkthrough'), fill: true },
    { key: 'author', label: t('column.author'), wide: true },
    { key: 'language', label: t('column.language'), wide: true },
    { key: 'verdict', label: t('column.verdict'), wide: true },
    { key: 'updated', label: t('column.updated'), wide: true },
    { key: 'status', label: t('column.status') },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={walkthroughs}
      rowKey={walkthrough => walkthrough.id}
      columns={columns}
      paging={paging}
      empty={t('empty', { filtered: String(filtered) })}
      onOpen={onOpen}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      renderCell={(walkthrough, column) => {
        switch (column) {
          case 'walkthrough':
            return (
              <TwoLines
                first={titleOf(walkthrough.game)}
                second={walkthrough.text === '' ? t('noText') : walkthrough.text}
                narrow={t.rich('narrow', {
                  author: walkthrough.creator.name,
                  time: () => (
                    <Time value={walkthrough.updated} format="relative" tooltip={false} />
                  ),
                })}
              />
            )
          case 'author':
            return <UserRef user={walkthrough.creator} />
          case 'language':
            return (
              <Text as="span" size="sm">
                {t(`language.${languageOf(walkthrough)}`)}
              </Text>
            )
          case 'verdict':
            return <ModerationVerdict verdict={walkthrough.moderation} />
          case 'updated':
            return (
              <Time value={walkthrough.updated} format="relative" className="text-muted text-sm" />
            )
          default:
            return <StatusTags walkthrough={walkthrough} />
        }
      }}
    />
  )
}
