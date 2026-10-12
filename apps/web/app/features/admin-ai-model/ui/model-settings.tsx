import { Form, FormField, Grid, Inline, Input, Panel, Switch, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { settingsChanges, settingsOf, type Model, type SettingsDraft } from '../admin-ai-model'
import { settingsForm } from '../admin-ai-model.schema'
import { useModelChange } from '../use-model-change'

type ModelSettingsProps = {
  model: Model
  editable: boolean
}

export function ModelSettings({ model, editable }: ModelSettingsProps) {
  const t = useTranslations('adminAiModel.settings')
  const kit = useFormKit()
  const [draft, setDraft] = useState(() => settingsOf(model))
  const change = useModelChange()
  const form = useFormErrors(change.failure)
  const changes = settingsChanges(model, draft)
  const set = (next: Partial<SettingsDraft>) => setDraft({ ...draft, ...next })
  return (
    <Panel title={t('title')}>
      <Form
        ref={form}
        values={draft}
        rules={settingsForm(kit)}
        onSubmit={async () => {
          const outcome = await change.run({ action: 'update', id: model.id, changes })
          if (outcome.ok) {
            toast.success(t('saved'))
          }
        }}
      >
        <Grid gap="md" className="sm:grid-cols-2">
          <FormField name="name" label={t('name')}>
            <Input disabled={!editable} value={draft.name} onValueChange={name => set({ name })} />
          </FormField>
          <FormField name="description" label={t('description')}>
            <Input
              disabled={!editable}
              placeholder={t('optional')}
              value={draft.description}
              onValueChange={description => set({ description })}
            />
          </FormField>
        </Grid>
        <Switch
          disabled={!editable || model.is_default}
          checked={draft.isDefault}
          description={t(model.is_default ? 'defaultKept' : 'defaultHint')}
          onCheckedChange={isDefault => set({ isDefault })}
        >
          {t('default')}
        </Switch>
        <Inline>
          <Button
            type="submit"
            loading={change.pending}
            disabled={!editable || Object.keys(changes).length === 0}
          >
            {t('save')}
          </Button>
        </Inline>
      </Form>
    </Panel>
  )
}
