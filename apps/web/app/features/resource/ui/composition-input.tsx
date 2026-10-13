import { Alert, Card, FileUpload, FormField, Inline, Spinner, Text } from '@hina-ui/react'
import { CircleAlert, FileArchive, X } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { chosenFiles } from '~/features/upload'
import { useBytes } from '~/shared/i18n/use-bytes'
import { Button } from '~/shared/ui/button'
import type { InputPhase } from '../resource-composition'

type CompositionInputProps = {
  name: string
  label?: string
  drop: string
  phase: InputPhase
  transferred: { name: string; size: number } | undefined
  onChoose: (file: File) => void
  onRemove: () => void
}

export function CompositionInput({
  name,
  label,
  drop,
  phase,
  transferred,
  onChoose,
  onRemove,
}: CompositionInputProps) {
  const t = useTranslations('resource.composition')
  const bytes = useBytes()
  const input = 'input' in phase ? phase.input : undefined
  const shown = input ?? transferred
  const refusal = input?.refusal ?? null
  return (
    <>
      <FormField name={name} label={label} required={label !== undefined}>
        {phase.name === 'empty' || shown === undefined ? (
          <FileUpload
            value={null}
            onValueChange={value => {
              const [file] = chosenFiles(value)
              if (file !== undefined) {
                onChoose(file)
              }
            }}
          >
            {drop}
          </FileUpload>
        ) : (
          <Card padded={false} className="px-4 py-2.5">
            <Inline gap="sm" align="center" wrap={false}>
              <FileArchive aria-hidden className="size-4 shrink-0 text-muted" />
              <Text className="min-w-0 flex-1 break-all">{shown.name}</Text>
              <PhaseNote phase={phase} />
              <Text size="sm" tone="muted" className="shrink-0 tabular-nums">
                {bytes(shown.size)}
              </Text>
              <Button
                variant="ghost"
                tone="neutral"
                size="sm"
                iconOnly
                icon={<X />}
                aria-label={t('removeFile')}
                className="-me-2"
                onClick={onRemove}
              />
            </Inline>
          </Card>
        )}
      </FormField>
      <Alert tone="danger" open={refusal !== null || phase.name === 'failed'}>
        {refusal === null ? t('input.failed') : t(`refusal.${refusal}`)}
      </Alert>
    </>
  )
}

function PhaseNote({ phase }: { phase: InputPhase }) {
  const t = useTranslations('resource.composition.input')
  switch (phase.name) {
    case 'uploading':
    case 'reading':
      return (
        <Inline gap="xs" align="center" wrap={false} className="shrink-0">
          <Spinner size="sm" />
          <Text size="sm" tone="muted" className="tabular-nums">
            {phase.name === 'uploading' ? t('uploading', { percent: phase.percent }) : t('reading')}
          </Text>
        </Inline>
      )
    case 'failed':
    case 'refused':
      return <CircleAlert aria-label={t(phase.name)} className="size-4 shrink-0 text-danger-text" />
    case 'empty':
    case 'ready':
      return null
  }
}
