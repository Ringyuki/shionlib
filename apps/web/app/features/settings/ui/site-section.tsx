import { Panel, RadioGroup, SegmentedControl, Select, Switch } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import {
  contentLimitFrom,
  contentLimits,
  useLanguage,
  usePreferences,
  type Viewer,
} from '~/features/viewer'
import { localeNames, locales } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { themePreferences } from '~/shared/ui/theme'
import { useTheme } from '~/shared/ui/theme-provider'
import { isThemePreference } from '~/shared/ui/theme.schema'

export function SiteSection({ viewer }: { viewer: Viewer }) {
  const t = useTranslations('settings.site')
  const language = useLanguage()
  const theme = useTheme()
  const limit = usePreferences()
  const resources = usePreferences()
  return (
    <>
      <Panel title={t('language')} description={t('languageHint')}>
        <Select
          aria-label={t('language')}
          value={language.current}
          onValueChange={value => {
            if (isLocale(value)) {
              language.change(value)
            }
          }}
          options={locales.map(locale => ({ value: locale, label: localeNames[locale] }))}
          className="max-w-xs"
        />
      </Panel>
      <Panel title={t('theme')} description={t('themeHint')}>
        <SegmentedControl
          aria-label={t('theme')}
          value={theme.preference}
          onValueChange={value => {
            if (isThemePreference(value)) {
              theme.change(value)
            }
          }}
          options={themePreferences.map(preference => ({
            value: preference,
            label: t(`themes.${preference}`),
          }))}
        />
      </Panel>
      <Panel title={t('contentLimit')} description={t('contentLimitHint')}>
        <RadioGroup
          aria-label={t('contentLimit')}
          value={limit.saving?.contentLimit ?? viewer.content_limit}
          disabled={limit.pending}
          onValueChange={value => {
            const contentLimit = contentLimitFrom(value)
            if (contentLimit !== undefined) {
              void limit.save({ contentLimit })
            }
          }}
          options={contentLimits.map(value => ({
            value,
            label: t(`contentLimits.${value}.label`),
            description: t(`contentLimits.${value}.description`),
          }))}
        />
      </Panel>
      <Panel title={t('games')}>
        <Switch
          checked={resources.saving?.onlyGamesWithResources ?? viewer.only_games_with_resources}
          disabled={resources.pending}
          onCheckedChange={only => void resources.save({ onlyGamesWithResources: only })}
          description={t('onlyWithResourcesHint')}
        >
          {t('onlyWithResources')}
        </Switch>
      </Panel>
    </>
  )
}
