import { Inline, MultiCombobox, Text } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { chosenChoice, translatorChoices } from '../translator'
import { useTranslatorOptions } from '../use-translator-options'

type TranslatorFieldProps = {
  value: readonly string[]
  onValueChange: (value: string[]) => void
  invalid?: boolean
}

export function TranslatorField({ value, onValueChange, invalid }: TranslatorFieldProps) {
  const t = useTranslations('translator')
  const options = useTranslatorOptions()
  return (
    <MultiCombobox
      value={[...value]}
      onValueChange={next => {
        onValueChange(next.map(String))
        options.setSearch('')
      }}
      search={options.search}
      onSearchChange={options.setSearch}
      onOpenChange={open => {
        if (open) {
          options.prepare()
        }
      }}
      options={translatorChoices(options.found, options.search, value)}
      selectedOptions={value.map(chosenChoice)}
      renderOption={({ option }) =>
        option.fresh ? (
          <Inline gap="sm" align="center" wrap={false} className="min-w-0 flex-1">
            <Plus aria-hidden className="size-4 shrink-0" />
            <Text as="span" truncate>
              {t('create', { name: option.label })}
            </Text>
          </Inline>
        ) : (
          <Inline gap="sm" align="center" wrap={false} className="min-w-0 flex-1">
            <Text as="span" truncate>
              {option.label}
            </Text>
            <Text as="span" size="xs" tone="muted" className="ms-auto shrink-0 tabular-nums">
              {t('works', { count: option.works })}
            </Text>
          </Inline>
        )
      }
      loading={options.loading}
      ignoreFilter
      invalid={invalid}
      placeholder={t('fieldPlaceholder')}
      aria-label={t('fieldLabel')}
    />
  )
}
