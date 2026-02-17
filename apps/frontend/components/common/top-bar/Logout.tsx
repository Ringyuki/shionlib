import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from '@/components/shionui/DropdownMenu'
import { LogOut } from 'lucide-react'
import { useAuthDialogStore } from '@/store/authDialogStore'
import { useTranslations } from 'next-intl'

export const Logout = () => {
  const t = useTranslations('Components.Common.User.LogoutDialog')
  const { openLogoutDialog } = useAuthDialogStore()
  return (
    <DropdownMenuItem
      variant="destructive"
      className="cursor-pointer duration-200"
      onSelect={e => {
        e.preventDefault()
        openLogoutDialog()
      }}
    >
      <DropdownMenuLabel>{t('button')}</DropdownMenuLabel>
      <DropdownMenuShortcut>
        <LogOut className="text-red-500" />
      </DropdownMenuShortcut>
    </DropdownMenuItem>
  )
}
