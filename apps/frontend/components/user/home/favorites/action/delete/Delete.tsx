import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/shionui/AlertDialog'
import { shionlibRequest } from '@/utils/request'
import { useTranslations } from 'next-intl'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { Button } from '@/components/shionui/Button'
import { Trash } from 'lucide-react'

interface FavoriteDeleteProps {
  id: number
  onSuccess: (id: number) => void
}

export const FavoriteDelete = ({ id, onSuccess }: FavoriteDeleteProps) => {
  const t = useTranslations('Components.User.Home.Favorites.Action.Delete')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    try {
      setLoading(true)
      await shionlibRequest().delete(`/favorites/${id}`)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      setOpen(false)
      onSuccess(id)
    } catch {
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <Button
        intent="destructive"
        onClick={() => setOpen(true)}
        renderIcon={<Trash />}
        size="icon"
        appearance="ghost"
        loading={loading}
      />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent tone="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel tone="destructive">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              tone="destructive"
              loading={loading}
              onClick={e => {
                handleDelete()
                e.preventDefault()
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
