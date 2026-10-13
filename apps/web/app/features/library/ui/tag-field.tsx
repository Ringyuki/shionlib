import { Inline, MultiCombobox, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { useTagOptions } from '../use-tag-options'

type TagFieldProps = {
  value: readonly string[]
  onValueChange: (value: string[]) => void
}

export function TagField({ value, onValueChange }: TagFieldProps) {
  const t = useTranslations('library.filters')
  const format = useFormatter()
  const tags = useTagOptions()
  return (
    <MultiCombobox
      value={[...value]}
      onValueChange={next => onValueChange(next.map(String))}
      search={tags.search}
      onSearchChange={tags.setSearch}
      onOpenChange={open => {
        if (open) {
          tags.prepare()
        }
      }}
      options={tags.options.map(tag => ({ value: tag.name, label: tag.name, count: tag.count }))}
      selectedOptions={value.map(name => ({ value: name, label: name, count: 0 }))}
      renderOption={({ option }) => (
        <Inline gap="sm" align="center" wrap={false} className="min-w-0 flex-1">
          <Text as="span" truncate>
            {option.label}
          </Text>
          <Text as="span" size="xs" tone="muted" className="ms-auto shrink-0 tabular-nums">
            {format.number(option.count)}
          </Text>
        </Inline>
      )}
      loading={tags.loading}
      ignoreFilter
      placeholder={t('tagPlaceholder')}
    />
  )
}
