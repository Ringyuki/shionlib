'use client'

import { Button } from '@/components/shionui/Button'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { CharacterPermission } from '@/interfaces/edit/permisson.interface'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { useRouter } from '@/i18n/navigation.client'

interface EditProps {
  character_id: number
}

export const Edit = ({ character_id }: EditProps) => {
  const [editLoading, setEditLoading] = useState(false)
  const t = useTranslations('Components.Character.Actions')
  const { setCharacterPermissions } = useEditPermissionStore()
  const router = useRouter()

  const getPermissions = async () => {
    try {
      setEditLoading(true)
      const data = await shionlibRequest().post<CharacterPermission>(`/permissions`, {
        data: {
          entity: 'character',
        },
      })
      setCharacterPermissions(data.data as CharacterPermission)
      router.push(`/character/${character_id}/edit/scalar`, { scroll: true })
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
        appearance="outline"
        loginRequired
        loading={editLoading}
        onClick={getPermissions}
        renderIcon={<Pencil />}
      >
        {t('edit')}
      </Button>
    </>
  )
}
