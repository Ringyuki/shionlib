'use client'

import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useMedia } from 'react-use'
import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { FavoriteEditDialog } from './Dialog'
import { FavoriteEditDrawer } from './Drawer'
import { Pencil } from 'lucide-react'

interface FavoriteEditProps {
  favorite: Favorite
  onSuccess: (favorite: Favorite) => void
}

export const FavoriteEdit = ({ favorite, onSuccess }: FavoriteEditProps) => {
  const t = useTranslations('Components.User.Home.Favorites.Action.Edit')
  const [open, setOpen] = useState(false)
  const isMobile = useMedia('(max-width: 768px)', false)

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
        onClick={() => setOpen(true)}
      />
      {isMobile ? (
        <FavoriteEditDrawer
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleEdit}
          favorite={favorite}
        />
      ) : (
        <FavoriteEditDialog
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleEdit}
          favorite={favorite}
        />
      )}
    </>
  )
}
