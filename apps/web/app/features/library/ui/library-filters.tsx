import { FormField, MultiSelect, Stack, Switch } from '@hina-ui/react'
import { useFormatter, useMessages, useTranslations } from 'use-intl'
import { PlatformIcon, platforms } from '~/features/game'
import { labelOf } from '~/shared/i18n/labels'
import { ChoiceChips } from '~/shared/ui/choice-chips'
import {
  listsOnlyDownloadable,
  months,
  narrowedToResources,
  withResourcesOnly,
  type LibraryAddress,
} from '../library'
import { TagField } from './tag-field'

type LibraryFiltersProps = {
  address: LibraryAddress
  years: readonly number[]
  filtered: boolean
  onChange: (changes: Partial<LibraryAddress>) => void
}

export function LibraryFilters({ address, years, filtered, onChange }: LibraryFiltersProps) {
  const t = useTranslations('library.filters')
  const labels = useMessages().game.platform
  const format = useFormatter()
  const monthName = (month: number) =>
    format.dateTime(new Date(Date.UTC(2000, month - 1, 15)), { month: 'short', timeZone: 'UTC' })
  return (
    <Stack gap="md">
      <FormField label={t('tags')} description={t('tagsHint')}>
        <TagField value={address.tags} onValueChange={tags => onChange({ tags })} />
      </FormField>
      <FormField label={t('excluded')} description={t('excludedHint')}>
        <TagField value={address.excluded} onValueChange={excluded => onChange({ excluded })} />
      </FormField>
      <FormField label={t('platforms')}>
        <ChoiceChips
          label={t('platforms')}
          options={platforms}
          value={address.platforms}
          onValueChange={chosen => onChange({ platforms: chosen })}
          labelOf={platform => labelOf(labels, platform)}
          iconOf={platform => <PlatformIcon platform={platform} />}
        />
      </FormField>
      <FormField label={t('years')}>
        <MultiSelect
          aria-label={t('years')}
          value={address.years}
          onValueChange={chosen => onChange({ years: years.filter(year => chosen.includes(year)) })}
          options={years.map(year => ({ value: year, label: String(year) }))}
          placeholder={t('anyYear')}
          maxVisible={3}
          clearable
        />
      </FormField>
      <FormField label={t('months')}>
        <MultiSelect
          aria-label={t('months')}
          value={address.months}
          onValueChange={chosen =>
            onChange({ months: months.filter(month => chosen.includes(month)) })
          }
          options={months.map(month => ({ value: month, label: monthName(month) }))}
          placeholder={address.years.length === 0 ? t('yearFirst') : t('anyMonth')}
          disabled={address.years.length === 0}
          maxVisible={3}
          clearable
        />
      </FormField>
      <Switch
        checked={narrowedToResources(address, filtered)}
        disabled={listsOnlyDownloadable(address)}
        onCheckedChange={only => onChange(withResourcesOnly(only, filtered))}
      >
        {t('onlyWithResources')}
      </Switch>
    </Stack>
  )
}
