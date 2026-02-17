import { DropdownMenuItem } from '@/components/shionui/DropdownMenu'
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
import { Trash } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useShionlibUserStore } from '@/store/userStore'
import { useCommentListStore } from '@/store/commentListStore'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useState } from 'react'

interface DeleteProps {
  comment_id: number
  creator_id: number
}

export const Delete = ({ comment_id, creator_id }: DeleteProps) => {
  const t = useTranslations('Components.Common.Comment.Actions.Delete')
  const { user } = useShionlibUserStore()
  const { removeComment } = useCommentListStore()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    try {
      setLoading(true)
      await shionlibRequest().delete(`/comment/${comment_id}`)
      removeComment(comment_id)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      setOpen(false)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenuItem
        className="cursor-pointer duration-200"
        onClick={e => {
          e.preventDefault()
          setOpen(true)
        }}
        disabled={creator_id !== user.id && user.role !== 3}
        variant="destructive"
      >
        <Trash />
        {t('delete')}
      </DropdownMenuItem>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent tone="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel tone="destructive" onClick={() => setOpen(false)}>
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
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
