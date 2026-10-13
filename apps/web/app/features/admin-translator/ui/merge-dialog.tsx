import { Dialog, Form, FormField, Inline, RadioGroup, Text, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { keptByDefault, mergedInto, type Cluster } from '../admin-translator'
import { mergeForm } from '../admin-translator.schema'
import { useTranslatorChange } from '../use-translator-change'

type MergeDialogProps = {
  cluster: Cluster | undefined
  onClose: () => void
}

export function MergeDialog({ cluster, onClose }: MergeDialogProps) {
  const t = useTranslations('adminTranslator.merge')
  const shared = useTranslations('admin')
  const issue = useTranslations('adminTranslator.issue')
  const open = cluster !== undefined
  const shown = useLast(cluster) ?? []
  const [keep, setKeep] = useOpenState(open, () => keptByDefault(cluster ?? []))
  const merge = useTranslatorChange()
  const form = useFormErrors(merge.failure)
  return (
    <Dialog
      title={t('title')}
      description={t('description')}
      open={open}
      onOpenChange={next => {
        if (!next) {
          onClose()
        }
      }}
      renderContent={() => (
        <Form
          ref={form}
          values={{ keep }}
          rules={mergeForm(issue)}
          onSubmit={async () => {
            const kept = shown.find(translator => translator.id === keep)
            if (kept === undefined) {
              return
            }
            const outcome = await merge.run({
              action: 'merge',
              id: kept.id,
              mergedIds: mergedInto(shown, kept.id),
            })
            if (outcome.ok) {
              onClose()
              toast.success(t('done', { name: kept.name }))
            }
          }}
        >
          <FormField name="keep" label={t('keep')}>
            <RadioGroup
              block
              value={keep}
              options={shown.map(translator => ({
                value: translator.id,
                label: translator.name,
                resources: translator.resources_count,
              }))}
              onValueChange={value =>
                setKeep(shown.find(translator => translator.id === value)?.id ?? null)
              }
              renderOption={({ option }) => (
                <Inline as="span" gap="md" justify="between" wrap={false} className="w-full">
                  <Text as="span" className="min-w-0 break-all">
                    {option.label}
                  </Text>
                  <Text as="span" tone="muted" className="shrink-0 tabular-nums">
                    {t('resources', { count: option.resources })}
                  </Text>
                </Inline>
              )}
            />
          </FormField>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t('confirm')}
          </Button>
        </>
      )}
    />
  )
}
