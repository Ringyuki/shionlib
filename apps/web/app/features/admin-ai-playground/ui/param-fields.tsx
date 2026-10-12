import { FormField, Grid, NumberInput, Select, Textarea } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { rangeOf } from '~/shared/form/form-kit'
import type { Playground } from '../use-playground'

type ParamFieldsProps = {
  playground: Playground
  disabled: boolean
}

const shapes = ['text', 'structured'] as const

export function ParamFields({ playground, disabled }: ParamFieldsProps) {
  const t = useTranslations('adminAiPlayground.param')
  const { params, setParams } = playground
  return (
    <>
      <FormField name="system" label={t('system')}>
        <Textarea
          rows={3}
          disabled={disabled}
          value={params.system}
          onValueChange={system => setParams({ system })}
        />
      </FormField>
      <Grid gap="md" className="grid-cols-2">
        <FormField label={t('temperature')}>
          <NumberInput
            {...rangeOf('AiPlaygroundInputBody', 'temperature')}
            step={0.1}
            stepSnapping={false}
            controls={false}
            disabled={disabled}
            placeholder={t('default')}
            value={params.temperature}
            onValueChange={value => setParams({ temperature: value ?? null })}
          />
        </FormField>
        <FormField label={t('maxTokens')}>
          <NumberInput
            {...rangeOf('AiPlaygroundInputBody', 'max_output_tokens')}
            controls={false}
            disabled={disabled}
            placeholder={t('default')}
            value={params.maxOutputTokens}
            onValueChange={value => setParams({ maxOutputTokens: value ?? null })}
          />
        </FormField>
      </Grid>
      <FormField label={t('shape')} description={t('shapeHint')}>
        <Select
          disabled={disabled}
          value={params.structured ? 'structured' : 'text'}
          options={shapes.map(shape => ({ value: shape, label: t(`shapes.${shape}`) }))}
          onValueChange={picked => setParams({ structured: picked === 'structured' })}
        />
      </FormField>
      {params.structured && (
        <FormField name="schema" label={t('schema')}>
          <Textarea
            rows={6}
            className="font-mono"
            disabled={disabled}
            placeholder={t('schemaExample')}
            value={params.schema}
            onValueChange={schema => setParams({ schema })}
          />
        </FormField>
      )}
    </>
  )
}
