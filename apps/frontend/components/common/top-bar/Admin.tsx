import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from '@/components/shionui/DropdownMenu'
import { Shield as ShieldIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation.client'
import { useShionlibUserStore } from '@/store/userStore'

export const Admin = () => {
  const t = useTranslations('Components.Common.TopBar.Admin')
  const router = useRouter()
  const { user } = useShionlibUserStore()
  if (user.role < 2) return null

  return (
    <>
      <DropdownMenuItem
        variant="warning"
        className="cursor-pointer duration-200"
        onClick={() => router.push(`/admin`)}
      >
        <DropdownMenuLabel>{t('admin')}</DropdownMenuLabel>
        <DropdownMenuShortcut>
          <ShieldIcon className="text-warning" />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
    </>
  )
}
