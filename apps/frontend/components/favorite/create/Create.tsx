import { Button } from '@/components/shionui/Button'
import { PlusIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/shionui/Modal'
import { useState } from 'react'
import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { FavoriteCreateContent } from './Content'

interface FavoriteCreateProps {
  onSuccess: (favorite: Favorite) => void
}

export const FavoriteCreate = ({ onSuccess }: FavoriteCreateProps) => {
  const t = useTranslations('Components.Favorite.Create')
  const [open, setOpen] = useState(false)

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
        data-testid="favorite-create-trigger"
        onClick={() => setOpen(true)}
      >
        {t('create')}
      </Button>
      <Modal
        title={t('title')}
        description={t('description')}
        open={open}
        onOpenChange={setOpen}
        breakpoint={768}
        data-testid="favorite-create-dialog"
      >
        <FavoriteCreateContent onSuccess={handleCreate} className="px-4 pb-4" />
      </Modal>
    </>
  )
}
