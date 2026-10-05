import { Button, DropdownMenu, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@hina-ui/react'
import { Languages } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { locales } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { switchLocale } from '../shell'

const names = { zh: '简体中文', en: 'English', ja: '日本語' } as const

export function LocaleMenu() {
  const t = useTranslations('shell')
  const current = useLocale()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  return (
    <DropdownMenu
      align="end"
      label={t('language')}
      content={
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={value => {
            if (isLocale(value) && value !== current) {
              navigate(`${switchLocale(pathname, value)}${search}`)
            }
          }}
        >
          {locales.map(locale => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              {names[locale]}
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
