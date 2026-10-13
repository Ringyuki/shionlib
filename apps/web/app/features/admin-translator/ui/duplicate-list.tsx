import { Empty, Inline, Stack, Tag, Text, toast } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { clusterKey, idsOf, type Cluster } from '../admin-translator'
import { useTranslatorChange } from '../use-translator-change'

type DuplicateListProps = {
  clusters: Cluster[]
  onMerge: (cluster: Cluster) => void
}

export function DuplicateList({ clusters, onMerge }: DuplicateListProps) {
  const t = useTranslations('adminTranslator.duplicates')
  if (clusters.length === 0) {
    return <Empty size="sm" title={t('empty')} />
  }
  return (
    <Stack as="ul" gap="none" aria-label={t('label')} className="divide-line divide-y">
      {clusters.map(cluster => (
        <DuplicateRow key={clusterKey(cluster)} cluster={cluster} onMerge={onMerge} />
      ))}
    </Stack>
  )
}

function DuplicateRow({
  cluster,
  onMerge,
}: {
  cluster: Cluster
  onMerge: (cluster: Cluster) => void
}) {
  const t = useTranslations('adminTranslator.duplicates')
  const format = useFormatter()
  const dismiss = useTranslatorChange()
  return (
    <Inline
      as="li"
      gap="md"
      align="center"
      wrap={false}
      className="px-(--hn-panel-p) py-2.5 max-sm:flex-wrap"
    >
      <Inline gap="xs" className="min-w-0 flex-1">
        {cluster.map(translator => (
          <Tag key={translator.id} variant="outline" size="md" className="max-w-full">
            <Text as="span" size="sm" weight="medium" truncate>
              {translator.name}
            </Text>
            <Text as="span" size="sm" tone="faint" className="tabular-nums">
              {format.number(translator.resources_count)}
            </Text>
          </Tag>
        ))}
      </Inline>
      <Inline gap="sm" align="center" wrap={false} className="shrink-0 max-sm:ms-auto">
        <Button
          size="sm"
          variant="ghost"
          tone="neutral"
          loading={dismiss.pending}
          onClick={async () => {
            const outcome = await dismiss.run({ action: 'dismiss', ids: idsOf(cluster) })
            if (outcome.ok) {
              toast.success(t('dismissed'))
            }
          }}
        >
          {t('dismiss')}
        </Button>
        <Button size="sm" variant="outline" tone="neutral" onClick={() => onMerge(cluster)}>
          {t('merge')}
        </Button>
      </Inline>
    </Inline>
  )
}
