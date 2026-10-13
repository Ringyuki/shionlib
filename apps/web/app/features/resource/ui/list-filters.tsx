import { Divider, FormField, Inline, Stack } from '@hina-ui/react'
import { Fragment } from 'react'
import { useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { ChoiceChips } from '~/shared/ui/choice-chips'
import type { FilterGroup, FilterName, ListFilter } from '../resource-listing'

type ListFiltersProps = {
  groups: readonly FilterGroup[]
  filter: ListFilter
  onChange: (filter: ListFilter) => void
  stacked?: boolean
  className?: string
}

export function ListFilters({
  groups,
  filter,
  onChange,
  stacked = false,
  className,
}: ListFiltersProps) {
  const t = useTranslations('resource.list.group')
  const labels = useMessages()
  const names: Record<FilterName, Readonly<Record<string, string>>> = {
    kind: labels.resource.list.kind,
    language: labels.game.language,
    translation: labels.resource.translationName,
    platform: labels.game.platform,
  }
  const chips = (group: FilterGroup) => (
    <ChoiceChips
      label={t(group.name)}
      options={group.options}
      value={filter[group.name]}
      onValueChange={picked => onChange({ ...filter, [group.name]: picked })}
      labelOf={option => labelOf(names[group.name], option)}
    />
  )
  if (stacked) {
    return (
      <Stack gap="md" className={className}>
        {groups.map(group => (
          <FormField key={group.name} label={t(group.name)}>
            {chips(group)}
          </FormField>
        ))}
      </Stack>
    )
  }
  return (
    <Inline gap="sm" align="center" className={className}>
      {groups.map((group, index) => (
        <Fragment key={group.name}>
          {index > 0 && <Divider orientation="vertical" decorative className="h-4" />}
          {chips(group)}
        </Fragment>
      ))}
    </Inline>
  )
}
