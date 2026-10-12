import { FormField, Grid, Inline, NumberInput, Stack, Text, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { PaneSection, ReviewPane } from '~/features/admin'
import { rangeOf } from '~/shared/form/form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { draftOf, type Model, type Scene, type SceneDraft } from '../admin-ai-scene'
import { useSceneSave } from '../use-scene-save'
import { SceneModelSelect } from './scene-model-select'

type ScenePaneProps = {
  opened: Scene | undefined
  models: Model[]
  editable: boolean
  onClose: () => void
}

const blank: SceneDraft = {
  modelId: null,
  temperature: null,
  maxOutputTokens: null,
  timeoutSeconds: null,
}

const second = 1000

export function ScenePane({ opened, models, editable, onClose }: ScenePaneProps) {
  const t = useTranslations('adminAi.scenes.pane')
  const shared = useTranslations('admin')
  const open = opened !== undefined
  const shown = useLast(opened)
  const [draft, setDraft] = useOpenState(open, () =>
    opened === undefined ? blank : draftOf(opened),
  )
  const save = useSceneSave()
  const set = (changes: Partial<SceneDraft>) => setDraft({ ...draft, ...changes })
  return (
    <ReviewPane
      heading={shown?.label ?? ''}
      note={shown?.key}
      open={open}
      onClose={onClose}
      renderContent={() =>
        shown === undefined ? null : (
          <Stack gap="xl">
            <PaneSection label={t('model')}>
              <FormField label={t('model')} description={t(`accepts.${shown.output}`)}>
                <SceneModelSelect
                  scene={shown}
                  models={models}
                  disabled={!editable}
                  value={draft.modelId}
                  onChange={modelId => set({ modelId })}
                />
              </FormField>
            </PaneSection>
            <PaneSection label={t('params')}>
              <Grid gap="md" className="grid-cols-2">
                <FormField label={t('temperature')}>
                  <NumberInput
                    {...rangeOf('AiSceneUpdateInputBody', 'temperature')}
                    step={0.1}
                    stepSnapping={false}
                    controls={false}
                    disabled={!editable}
                    placeholder={t('modelDefault')}
                    value={draft.temperature}
                    onValueChange={value => set({ temperature: value ?? null })}
                  />
                </FormField>
                <FormField label={t('maxTokens')}>
                  <NumberInput
                    {...rangeOf('AiSceneUpdateInputBody', 'max_output_tokens')}
                    controls={false}
                    disabled={!editable}
                    placeholder={t('modelDefault')}
                    value={draft.maxOutputTokens}
                    onValueChange={value => set({ maxOutputTokens: value ?? null })}
                  />
                </FormField>
              </Grid>
              <FormField label={t('timeout')} description={t('timeoutHint')}>
                <Inline gap="sm" align="center" wrap={false}>
                  <NumberInput
                    {...rangeOf('AiSceneUpdateInputBody', 'timeout_ms', second)}
                    controls={false}
                    className="w-28"
                    disabled={!editable}
                    placeholder={t('siteDefault')}
                    value={draft.timeoutSeconds}
                    onValueChange={value => set({ timeoutSeconds: value ?? null })}
                  />
                  <Text as="span" size="sm" tone="muted">
                    {t('seconds')}
                  </Text>
                </Inline>
              </FormField>
            </PaneSection>
          </Stack>
        )
      }
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={save.pending} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button
            loading={save.pending}
            disabled={!editable || shown === undefined}
            onClick={async () => {
              if (shown === undefined) {
                return
              }
              const outcome = await save.run({ ...draft, key: shown.key })
              if (outcome.ok) {
                onClose()
                toast.success(t('saved', { scene: shown.label }))
              }
            }}
          >
            {t('save')}
          </Button>
        </>
      )}
    />
  )
}
