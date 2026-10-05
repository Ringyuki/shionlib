import { Button, DropdownMenu, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@hina-ui/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { themePreferences } from '~/shared/ui/theme'
import { isThemePreference } from '~/shared/ui/theme.schema'
import { useTheme } from '~/shared/ui/theme-provider'

const icons = { system: Monitor, light: Sun, dark: Moon } as const

export function ThemeMenu() {
  const t = useTranslations('shell.theme')
  const theme = useTheme()
  const Icon = icons[theme.preference]
  return (
    <DropdownMenu
      align="end"
      label={t('label')}
      content={
        <DropdownMenuRadioGroup
          value={theme.preference}
          onValueChange={value => {
            if (isThemePreference(value)) {
              theme.change(value)
            }
          }}
        >
          {themePreferences.map(preference => (
            <DropdownMenuRadioItem key={preference} value={preference}>
              {t(preference)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      }
    >
      <Button variant="ghost" tone="neutral" iconOnly aria-label={t('label')} icon={<Icon />} />
    </DropdownMenu>
  )
}
