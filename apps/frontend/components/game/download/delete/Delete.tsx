import { useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
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
import { useTranslations } from 'next-intl'
// import toast from 'react-hot-toast'
import { sileo } from 'sileo'

interface DeleteProps {
  id: number
  onSuccess: (id: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadingChange: (loading: boolean) => void
}

export const Delete = ({ id, onSuccess, open, onOpenChange, onLoadingChange }: DeleteProps) => {
  const t = useTranslations('Components.Game.Download.Delete')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    onOpenChange(open)
  }, [open, onOpenChange])
  useEffect(() => {
    onLoadingChange(loading)
  }, [loading, onLoadingChange])

  const handleDelete = async () => {
    try {
      setLoading(true)
      await shionlibRequest().delete(`/game/download-source/${id}`)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      onOpenChange(false)
      await new Promise(resolve => setTimeout(resolve, 500)) // wait for the animation to complete
      onSuccess(id)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent tone="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel tone="destructive" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </AlertDialogCancel>
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
