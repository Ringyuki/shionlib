import { DropdownMenu, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@hina-ui/react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { downloadMethods } from '../download'
import { downloadMethodFrom } from '../download.schema'
import { useDownloadSettings } from '../use-download-settings'

export function DownloadMethodMenu() {
  const t = useTranslations('download')
  const { settings, save } = useDownloadSettings()
  const choose = (value: string) => {
    const method = downloadMethodFrom(value)
    if (method !== undefined) {
      save({ ...settings, method })
    }
  }
  return (
    <DropdownMenu
      align="end"
      content={
        <DropdownMenuRadioGroup value={settings.method} onValueChange={choose}>
          {downloadMethods.map(method => (
            <DropdownMenuRadioItem key={method} value={method}>
              {t(`methodName.${method}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      }
    >
      <Button variant="ghost" tone="neutral" size="sm" trailing={<ChevronDown />}>
        {t('method', { method: t(`methodName.${settings.method}`) })}
      </Button>
    </DropdownMenu>
  )
}
