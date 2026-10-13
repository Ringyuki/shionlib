import { FormField, Inline, Select, Stack } from '@hina-ui/react'
import { Plus, X } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button, IconButton } from '~/shared/ui/button'
import { maxTargets, optionsOf, targetKinds, type Choices } from '../admin-ai-playground'
import type { Playground } from '../use-playground'

type TargetFieldsProps = {
  choices: Choices
  playground: Playground
  disabled: boolean
}

export function TargetFields({ choices, playground, disabled }: TargetFieldsProps) {
  const t = useTranslations('adminAiPlayground.target')
  const { lanes } = playground
  const locked = disabled || playground.busy
  const kinds = targetKinds.filter(kind => optionsOf(choices, kind).length > 0)
  return (
    <FormField label={t('label')} description={t('hint', { max: maxTargets })}>
      <Stack gap="sm">
        {lanes.map(({ target }, index) => (
          <Inline key={`${index}-${target.kind}`} gap="xs" align="center" wrap={false}>
            <Select
              size="sm"
              className="w-24 shrink-0"
              aria-label={t('kindOf', { index: index + 1 })}
              disabled={locked}
              value={target.kind}
              options={kinds.map(kind => ({ value: kind, label: t(`kind.${kind}`) }))}
              onValueChange={picked => {
                const kind = kinds.find(known => known === picked)
                const first = kind === undefined ? undefined : optionsOf(choices, kind)[0]
                if (kind !== undefined && first !== undefined && kind !== target.kind) {
                  playground.retarget(index, { kind, id: first.value })
                }
              }}
            />
            <Select
              size="sm"
              className="min-w-0 flex-1"
              aria-label={t('valueOf', { index: index + 1 })}
              disabled={locked}
              value={target.id}
              options={optionsOf(choices, target.kind)}
              onValueChange={picked => {
                if (picked !== target.id && picked != null) {
                  playground.retarget(index, { kind: target.kind, id: String(picked) })
                }
              }}
            />
            <IconButton
              variant="ghost"
              tone="neutral"
              size="sm"
              label={t('remove', { index: index + 1 })}
              disabled={locked || lanes.length < 2}
              onClick={() => playground.remove(index)}
            >
              <X />
            </IconButton>
          </Inline>
        ))}
        <Button
          size="sm"
          variant="outline"
          tone="neutral"
          icon={<Plus />}
          disabled={locked || lanes.length >= maxTargets}
          onClick={playground.add}
        >
          {t('add')}
        </Button>
      </Stack>
    </FormField>
  )
}
