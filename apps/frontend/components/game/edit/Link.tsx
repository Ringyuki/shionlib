'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { GameLink } from '@/interfaces/game/game.interface'
import { Edit } from './link/Edit'
import { Add } from './link/Add'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Empty } from '@/components/common/content/Empty'
import { FieldSyncButton } from './sync/FieldSyncButton'

interface LinkEditProps {
  initLinks: GameLink[]
  id: number
}

export const LinkEdit = ({ initLinks, id }: LinkEditProps) => {
  const t = useTranslations('Components.Game.Edit.Link')
  const [links, setLinks] = useState(initLinks)

  const fetchLinks = useCallback(async () => {
    try {
      const res = await shionlibRequest().get<GameLink[]>(`/edit/game/${id}/links`)
      setLinks(res.data || [])
    } catch {}
  }, [id])

  const { gamePermissions: permissions } = useEditPermissionStore()
  if (!permissions?.relationFields.includes('MANAGE_LINKS')) {
    return <Empty title={t('noPermission')} />
  }

  const handleAdd = async () => {
    await fetchLinks()
  }

  const handleDelete = async (linkId: number) => {
    setLinks(links.filter(l => l.id !== linkId))
  }

  const handleUpdate = (updated: GameLink) => {
    setLinks(links.map(l => (l.id === updated.id ? updated : l)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        {links.map(link => (
          <Edit
            key={link.id}
            link={link}
            game_id={id}
            onSuccess={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
        {links.length === 0 && <Empty title={t('no_links')} />}
      </div>
      <FieldSyncButton gameId={id} field="links" onApplied={fetchLinks} />
      <Add game_id={id} onAdd={handleAdd} />
    </div>
  )
}
