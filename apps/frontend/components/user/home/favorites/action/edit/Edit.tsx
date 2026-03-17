'use client'

import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { Modal } from '@/components/shionui/Modal'
import { Pencil } from 'lucide-react'
import { FavoriteEditContent } from './Content'

interface FavoriteEditProps {
  favorite: Favorite
  onSuccess: (favorite: Favorite) => void
}

export const FavoriteEdit = ({ favorite, onSuccess }: FavoriteEditProps) => {
  const t = useTranslations('Components.User.Home.Favorites.Action.Edit')
  const [open, setOpen] = useState(false)

  const handleEdit = (updated: Favorite) => {
    setOpen(false)
    onSuccess?.(updated)
  }

  return (
    <>
      <Button
        size="icon"
        appearance="ghost"
        renderIcon={<Pencil className="size-4" />}
        aria-label={t('edit')}
        data-testid={`favorite-edit-trigger-${favorite.id}`}
        onClick={() => setOpen(true)}
      />
      <Modal
        title={t('title')}
        description={t('description')}
        open={open}
        onOpenChange={setOpen}
        breakpoint={768}
        data-testid={`favorite-edit-dialog-${favorite.id}`}
      >
        <FavoriteEditContent favorite={favorite} onSuccess={handleEdit} />
      </Modal>
    </>
  )
}
