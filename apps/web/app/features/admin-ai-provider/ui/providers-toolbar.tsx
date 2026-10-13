import { Inline, SearchInput, Select, toast } from '@hina-ui/react'
import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { useQueryDraft } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { providerStates, type Filter } from '../admin-ai-provider'
import { useProviderChange } from '../use-provider-change'

type ProvidersToolbarProps = {
  filter: Filter
  editable: boolean
  onShow: (changes: Partial<Filter>) => void
}

const every = 'all'

const typingDelay = 300

export function ProvidersToolbar({ filter, editable, onShow }: ProvidersToolbarProps) {
  const t = useTranslations('adminAiProvider')
  const search = useQueryDraft(filter.query, typingDelay, query => onShow({ query }))
  const change = useProviderChange()
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
      <Select
        size="sm"
        aria-label={t('stateFilter')}
        className="w-36"
        value={filter.state ?? every}
        options={[
          { value: every, label: t('state.all') },
          ...providerStates.map(state => ({ value: state, label: t(`state.${state}`) })),
        ]}
        onValueChange={value => onShow({ state: providerStates.find(state => state === value) })}
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
            const outcome = await change.run({ action: 'checkAll' })
            if (outcome.ok && outcome.result.kind === 'checked') {
              const { checked, failed } = outcome.result
              if (failed === 0) {
                toast.success(t('checked.fine', { count: checked }))
              } else {
                toast.warning(t('checked.failed', { count: checked, failed }))
              }
            }
          }}
        >
          {t('checkAll')}
        </Button>
      </Inline>
    </Inline>
  )
}
