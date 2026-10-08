import { Button, DropdownMenu, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@hina-ui/react'
import { Languages } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { useLanguage } from '~/features/viewer'
import { localeNames, locales } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'

export function LocaleMenu() {
  const t = useTranslations('shell')
  const language = useLanguage()
  return (
    <DropdownMenu
      align="end"
      label={t('language')}
      content={
        <DropdownMenuRadioGroup
          value={language.current}
          onValueChange={value => {
            if (isLocale(value)) {
              language.change(value)
            }
          }}
        >
          {locales.map(locale => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              {localeNames[locale]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      }
    >
      <Button
        variant="ghost"
        tone="neutral"
        iconOnly
        aria-label={t('language')}
        icon={<Languages />}
      />
    </DropdownMenu>
  )
}
