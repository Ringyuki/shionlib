import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { Plus } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from '@/components/shionui/DropdownMenu'
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

interface AddToRecentUpdateProps {
  game_id: number
}

export const AddToRecentUpdate = ({ game_id }: AddToRecentUpdateProps) => {
  const t = useTranslations('Components.Game.Actions.More.AddToRecentUpdate')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleAddToRecentUpdate = async () => {
    try {
      setLoading(true)
      await shionlibRequest().put(`/admin/content/games/${game_id}/recent-update`)
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
        onClick={e => {
          e.preventDefault()
          setOpen(true)
        }}
        disabled={loading}
      >
        <DropdownMenuLabel>{t('addToRecentUpdate')}</DropdownMenuLabel>
        <DropdownMenuShortcut>
          <Plus className="text-primary-500" />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent tone="info">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('addToRecentUpdate')}</AlertDialogTitle>
            <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel tone="info">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              tone="info"
              loading={loading}
              onClick={e => {
                handleAddToRecentUpdate()
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
