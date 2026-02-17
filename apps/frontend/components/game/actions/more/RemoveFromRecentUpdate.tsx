import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { Minus } from 'lucide-react'
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

interface RemoveFromRecentUpdateProps {
  game_id: number
}

export const RemoveFromRecentUpdate = ({ game_id }: RemoveFromRecentUpdateProps) => {
  const t = useTranslations('Components.Game.Actions.More.RemoveFromRecentUpdate')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRemoveFromRecentUpdate = async () => {
    try {
      setLoading(true)
      await shionlibRequest().delete(`/admin/content/games/${game_id}/recent-update`)
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
        variant="destructive"
      >
        <DropdownMenuLabel>{t('removeFromRecentUpdate')}</DropdownMenuLabel>
        <DropdownMenuShortcut>
          <Minus className="text-red-500" />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent tone="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeFromRecentUpdate')}</AlertDialogTitle>
            <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel tone="destructive">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              tone="destructive"
              loading={loading}
              onClick={e => {
                handleRemoveFromRecentUpdate()
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
