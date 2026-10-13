import { Card, FormField, Inline, RadioGroup, Stack, Switch, Text } from '@hina-ui/react'
import { Folder } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import { inputPhase, type Composition } from '../resource-composition'
import type { CompositionTransfer } from '../use-composition-transfer'
import { CompositionInput } from './composition-input'

type CompositionExtrasProps = {
  composition: Composition
  save: CompositionTransfer
  keepPatch: boolean
  onKeepPatch: (keep: boolean) => void
  onRemoveSave: () => void
}

export function CompositionExtrasStep({
  composition,
  save,
  keepPatch,
  onKeepPatch,
  onRemoveSave,
}: CompositionExtrasProps) {
  const t = useTranslations('resource.composition')
  const bytes = useBytes()
  const phase = inputPhase(composition.save, save.transfer)
  const [wanted, setWanted] = useState(phase.name !== 'empty')
  const removeSave = () => {
    save.stop()
    if (composition.save !== null) {
      onRemoveSave()
    }
  }
  return (
    <Stack gap="lg">
      <FormField name="save" label={t('save')}>
        <Stack gap="sm">
          <RadioGroup
            options={[
              { value: 'upload', label: t('saveChoice.upload') },
              { value: 'none', label: t('saveChoice.none') },
            ]}
            value={wanted || phase.name !== 'empty' ? 'upload' : 'none'}
            onValueChange={value => {
              setWanted(value === 'upload')
              if (value === 'none') {
                removeSave()
              }
            }}
          />
          {(wanted || phase.name !== 'empty') && (
            <CompositionInput
              name="saveFile"
              drop={t('saveDrop')}
              phase={phase}
              transferred={save.transfer}
              onChoose={save.send}
              onRemove={removeSave}
            />
          )}
        </Stack>
      </FormField>
      <Switch block controlPlacement="end" checked={keepPatch} onCheckedChange={onKeepPatch}>
        {t('keepPatch')}
      </Switch>
      <FormField name="contents" label={t('contents')}>
        <Card padded={false} className="px-4 py-1">
          <Stack role="list" gap="none">
            {(composition.folders ?? []).map(folder => (
              <Inline
                key={folder.role}
                role="listitem"
                gap="sm"
                align="center"
                wrap={false}
                className="min-h-10"
              >
                <Folder aria-hidden className="size-4 shrink-0 text-muted" />
                <Text as="span" className="min-w-0 break-all">
                  {folder.name}
                </Text>
                <Text as="span" size="sm" tone="faint" className="shrink-0 tabular-nums">
                  {t('items', { count: folder.items })}
                </Text>
                <Text as="span" size="sm" tone="muted" className="ms-auto shrink-0 tabular-nums">
                  {bytes(folder.size)}
                </Text>
              </Inline>
            ))}
          </Stack>
        </Card>
      </FormField>
      <FormField name="fileName" label={t('fileName')}>
        <Stack className="rounded-lg bg-inset px-4 py-3.5">
          <Text weight="medium" className="break-all">
            {composition.file_name}
          </Text>
        </Stack>
      </FormField>
    </Stack>
  )
}
