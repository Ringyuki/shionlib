import { Dialog, Form, toast } from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { aiPaths, protocols } from '~/features/admin-ai'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { oncePerProvider, type CatalogModel } from '../admin-ai-model'
import { createForm } from '../admin-ai-model.schema'
import { useCatalogSearch } from '../use-catalog-search'
import { useModelChange } from '../use-model-change'
import { CatalogPicker } from './catalog-picker'
import { ModelAddFields, type AddDraft } from './model-add-fields'

type ModelAddDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const blank: AddDraft = { name: '', description: '', providers: [] }

export function ModelAddDialog({ open, onOpenChange }: ModelAddDialogProps) {
  const t = useTranslations('adminAiModel.add')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const navigate = useNavigate()
  const [query, setQuery] = useOpenState(open, () => '')
  const [picked, setPicked] = useOpenState<CatalogModel | undefined>(open, () => undefined)
  const [draft, setDraft] = useOpenState(open, () => blank)
  const catalog = useCatalogSearch(query, open)
  const change = useModelChange()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('title')}
      description={t('hint')}
      size="lg"
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() =>
        picked === undefined ? (
          <CatalogPicker
            {...catalog}
            query={query}
            onQueryChange={setQuery}
            onPick={model => {
              setPicked(model)
              setDraft({
                name: model.name,
                description: '',
                providers: oncePerProvider(model.offers).map(offer => offer.provider.id),
              })
            }}
          />
        ) : (
          <Form
            ref={form}
            values={draft}
            rules={createForm(kit)}
            onSubmit={async () => {
              const outcome = await change.run({
                action: 'create',
                canonicalId: picked.canonical_id,
                name: draft.name,
                description: draft.description,
                routes: oncePerProvider(picked.offers)
                  .filter(offer => draft.providers.includes(offer.provider.id))
                  .map(offer => ({
                    providerId: offer.provider.id,
                    upstreamId: offer.upstream_id,
                    protocol: protocols.find(protocol => protocol === offer.protocol) ?? 'chat',
                  })),
              })
              if (outcome.ok && outcome.result.kind === 'created') {
                onOpenChange(false)
                toast.success(t('done', { name: draft.name.trim() }))
                void navigate(aiPaths.model(outcome.result.id))
              }
            }}
          >
            <ModelAddFields
              model={picked}
              draft={draft}
              onChange={changes => setDraft({ ...draft, ...changes })}
              onBack={() => setPicked(undefined)}
            />
          </Form>
        )
      }
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button
            loading={submitting}
            disabled={picked === undefined}
            onClick={() => void form.current?.submit()}
          >
            {t('submit')}
          </Button>
        </>
      )}
    />
  )
}
