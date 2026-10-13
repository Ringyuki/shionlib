import { Inline, SearchInput, SegmentedControl, toast } from '@hina-ui/react'
import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { useQueryDraft } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { capabilities, type Filter } from '../admin-ai-model'
import { useModelChange } from '../use-model-change'

type ModelsToolbarProps = {
  filter: Filter
  editable: boolean
  onShow: (changes: Partial<Filter>) => void
}

const every = 'all'

const typingDelay = 300

export function ModelsToolbar({ filter, editable, onShow }: ModelsToolbarProps) {
  const t = useTranslations('adminAiModel')
  const kinds = useTranslations('adminAi.capability')
  const search = useQueryDraft(filter.query, typingDelay, query => onShow({ query }))
  const change = useModelChange()
  return (
    <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
      <SearchInput
        size="sm"
        aria-label={t('search')}
        placeholder={t('search')}
        className="w-56 max-sm:w-full"
        value={search.draft}
        onValueChange={search.setDraft}
      />
      <SegmentedControl
        size="sm"
        aria-label={t('capabilityFilter')}
        value={filter.capability ?? every}
        options={[
          { value: every, label: t('all') },
          ...capabilities.map(capability => ({ value: capability, label: kinds(capability) })),
        ]}
        onValueChange={value =>
          onShow({ capability: capabilities.find(capability => capability === value) })
        }
      />
      <Inline className="ms-auto">
        <Button
          size="sm"
          variant="outline"
          tone="neutral"
          icon={<RefreshCw />}
          disabled={!editable}
          loading={change.pending}
          onClick={async () => {
            const outcome = await change.run({ action: 'syncCatalog' })
            if (outcome.ok && outcome.result.kind === 'synced') {
              toast.success(t('synced.title'), { description: t('synced.counts', outcome.result) })
            }
          }}
        >
          {t('syncCatalog')}
        </Button>
      </Inline>
    </Inline>
  )
}
