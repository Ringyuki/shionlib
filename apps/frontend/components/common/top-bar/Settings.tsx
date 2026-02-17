import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from '@/components/shionui/DropdownMenu'
import { Settings as SettingsIcon, User as UserIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation.client'

export const Settings = () => {
  const t = useTranslations('Components.Common.TopBar.Settings')
  const router = useRouter()
  return (
    <>
      <DropdownMenuItem
        variant="default"
        className="cursor-pointer duration-200"
        onClick={() => router.push('/user/settings/personal')}
      >
        <DropdownMenuLabel>{t('settings')}</DropdownMenuLabel>
        <DropdownMenuShortcut>
          <SettingsIcon className="text-primary" />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
    </>
  )
}
