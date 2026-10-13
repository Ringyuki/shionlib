import { Divider, FormField, Inline, Input, Stack, Text, Textarea } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import type { OrderValues } from '../sponsor.schema'

type ContentFieldsProps = {
  values: OrderValues
  onValuesChange: (values: OrderValues) => void
  named: boolean
}

const messageLength = lengthOf('CreateSponsorOrderInputBody', 'message').max

export function ContentFields({ values, onValuesChange, named }: ContentFieldsProps) {
  const t = useTranslations('sponsor.checkout')
  const optional = (label: string) => (
    <Inline as="span" gap="sm" align="baseline">
      <Text as="span" weight="semibold" className="text-md">
        {label}
      </Text>
      <Text as="span" size="xs" tone="muted" weight="normal">
        {t('optional')}
      </Text>
    </Inline>
  )
  return (
    <Stack gap="lg">
      {named && (
        <FormField name="name" label={optional(t('name'))}>
          <Input
            value={values.name}
            onValueChange={name => onValuesChange({ ...values, name })}
            className="max-w-90"
          />
        </FormField>
      )}
      {named && <Divider />}
      <Stack gap="xs">
        <FormField name="message" label={optional(t('message'))}>
          <Textarea
            value={values.message}
            onValueChange={message => onValuesChange({ ...values, message })}
            autosize={{ minRows: 3, maxRows: 8 }}
          />
        </FormField>
        <Text size="xs" tone="faint" className="self-end tabular-nums">
          {`${[...values.message].length} / ${messageLength}`}
        </Text>
      </Stack>
    </Stack>
  )
}
