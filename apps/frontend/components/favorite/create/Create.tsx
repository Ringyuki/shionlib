import { Button } from '@/components/shionui/Button'
import { PlusIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FavoriteCreateDialog } from './Dialog'
import { FavoriteCreateDrawer } from './Drawer'
import { useState } from 'react'
import { useMedia } from 'react-use'
import { Favorite } from '@/interfaces/favorite/favorite.interface'

interface FavoriteCreateProps {
  onSuccess: (favorite: Favorite) => void
}

export const FavoriteCreate = ({ onSuccess }: FavoriteCreateProps) => {
  const t = useTranslations('Components.Favorite.Create')
  const [open, setOpen] = useState(false)
  const isMobile = useMedia('(max-width: 768px)', false)

  const handleCreate = (favorite: Favorite) => {
    setOpen(false)
    onSuccess?.(favorite)
  }
  return (
    <>
      <Button
        intent="primary"
        appearance="outline"
        renderIcon={<PlusIcon className="size-4" />}
        onClick={() => setOpen(true)}
      >
        {t('create')}
      </Button>
      {isMobile ? (
        <FavoriteCreateDrawer open={open} onOpenChange={setOpen} onSuccess={handleCreate} />
      ) : (
        <FavoriteCreateDialog open={open} onOpenChange={setOpen} onSuccess={handleCreate} />
      )}
    </>
  )
}
