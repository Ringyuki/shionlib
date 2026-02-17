import { Button } from '@/components/shionui/Button'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { GamePermission } from '@/interfaces/edit/permisson.interface'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { useRouter } from '@/i18n/navigation.client'

interface EditProps {
  game_id: number
}

export const Edit = ({ game_id }: EditProps) => {
  const [editLoading, setEditLoading] = useState(false)
  const t = useTranslations('Components.Game.Actions')
  const { setGamePermissions } = useEditPermissionStore()
  const router = useRouter()

  const getPermissions = async () => {
    try {
      setEditLoading(true)
      const data = await shionlibRequest().post<GamePermission>(`/permissions`, {
        data: {
          entity: 'game',
        },
      })
      setGamePermissions(data.data as GamePermission)
      router.push(`/game/${game_id}/edit/scalar`, { scroll: true })
      return data.data
    } catch {
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <>
      <Button
        intent="primary"
        appearance="ghost"
        loginRequired
        loading={editLoading}
        onClick={getPermissions}
        renderIcon={<Pencil />}
        className="hidden md:block"
      >
        {t('edit')}
      </Button>
      <Button
        intent="primary"
        appearance="ghost"
        size="icon"
        loginRequired
        loading={editLoading}
        onClick={getPermissions}
        renderIcon={<Pencil />}
        className="flex md:hidden"
      />
    </>
  )
}
