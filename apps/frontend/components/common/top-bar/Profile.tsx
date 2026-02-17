import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from '@/components/shionui/DropdownMenu'
import { User as UserIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation.client'
import { useShionlibUserStore } from '@/store/userStore'

export const Profile = () => {
  const t = useTranslations('Components.Common.TopBar.Profile')
  const router = useRouter()
  const { user } = useShionlibUserStore()
  return (
    <>
      <DropdownMenuItem
        variant="default"
        className="cursor-pointer duration-200"
        onClick={() => router.push(`/user/${user.id}/uploads`)}
      >
        <DropdownMenuLabel>{t('profile')}</DropdownMenuLabel>
        <DropdownMenuShortcut>
          <UserIcon className="text-primary" />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
    </>
  )
}
