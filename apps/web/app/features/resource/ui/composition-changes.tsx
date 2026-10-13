import { Divider, Inline, Stack, Tag, Text } from '@hina-ui/react'
import { File, Folder } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import { changesOf, unlistedChanges, type CompositionPlan } from '../resource-composition'

export function CompositionChanges({ plan }: { plan: CompositionPlan }) {
  const t = useTranslations('resource.composition')
  const bytes = useBytes()
  const unlisted = unlistedChanges(plan)
  return (
    <Stack gap="sm">
      <Inline gap="md" align="center" className="gap-y-1">
        <Inline gap="xs" align="center">
          <Tag size="sm" tone="success">
            {t('added')}
          </Tag>
          <Text as="span" size="sm" className="tabular-nums">
            {t('changedFiles', { count: plan.adds.files })}
          </Text>
        </Inline>
        <Inline gap="xs" align="center">
          <Tag size="sm" tone="warning">
            {t('replaced')}
          </Tag>
          <Text as="span" size="sm" className="tabular-nums">
            {t('changedFiles', { count: plan.replaces.files })}
          </Text>
        </Inline>
        <Text as="span" size="sm" tone="muted" className="ms-auto tabular-nums">
          {t('total', { files: plan.total.files, size: bytes(plan.total.size) })}
        </Text>
      </Inline>
      <Stack role="list" aria-label={t('changesLabel')} gap="none">
        {changesOf(plan).map(change => (
          <Row
            key={change.path}
            icon={<File aria-hidden className="size-4 shrink-0 text-muted" />}
            name={change.path}
            mark={
              <Tag size="sm" tone={change.oldSize === null ? 'success' : 'warning'}>
                {t(change.oldSize === null ? 'added' : 'replaced')}
              </Tag>
            }
            before={change.oldSize === null ? undefined : bytes(change.oldSize)}
            size={bytes(change.size)}
          />
        ))}
        {unlisted > 0 && <Row name={t('unlisted', { count: unlisted })} faint size="" />}
        <Row
          icon={<Folder aria-hidden className="size-4 shrink-0 text-muted" />}
          name={t('unchanged')}
          mark={
            <Text as="span" size="sm" tone="faint" className="tabular-nums">
              {t('unchangedCount', { count: plan.unchanged.files })}
            </Text>
          }
          faint
          size={bytes(plan.unchanged.size)}
        />
      </Stack>
    </Stack>
  )
}

type RowProps = {
  icon?: ReactNode
  name: string
  mark?: ReactNode
  before?: string
  size: string
  faint?: boolean
}

function Row({ icon, name, mark, before, size, faint = false }: RowProps) {
  return (
    <Fragment>
      <Inline role="listitem" gap="sm" align="center" wrap={false} className="min-h-10 py-1">
        {icon}
        <Inline gap="sm" align="center" className="min-w-0 flex-1 gap-y-0.5">
          <Text as="span" tone={faint ? 'muted' : undefined} className="break-all">
            {name}
          </Text>
          {mark}
        </Inline>
        {before !== undefined && (
          <Text as="s" size="sm" tone="faint" className="shrink-0 tabular-nums">
            {before}
          </Text>
        )}
        <Text as="span" size="sm" tone="muted" className="shrink-0 tabular-nums">
          {size}
        </Text>
      </Inline>
      <Divider />
    </Fragment>
  )
}
