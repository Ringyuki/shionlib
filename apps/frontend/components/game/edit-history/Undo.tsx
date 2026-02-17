import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { UndoIcon } from 'lucide-react'
import { shionlibRequest } from '@/utils/request'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from '@/components/shionui/AlertDialog'
import { useState } from 'react'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { UndoOption, UndoOptionComponent } from './UndoOptions'

interface UndoProps {
  edit_id: number
}

export const Undo = ({ edit_id }: UndoProps) => {
  const t = useTranslations('Components.Game.EditHistory')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [undoOption, setUndoOption] = useState<UndoOption>({
    force: false,
    mode: 'strict',
  })

  const undoEdit = async (edit_id: number) => {
    try {
      setLoading(true)
      await shionlibRequest().post(`/edit/${edit_id}/undo`, {
        data: {
          force: undoOption.force,
          mode: undoOption.mode,
        },
      })
      setOpen(false)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          intent="destructive"
          appearance="soft"
          size="sm"
          renderIcon={<UndoIcon className="size-4" />}
          onClick={() => setOpen(true)}
          loading={loading}
        >
          {t('undo')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent tone="destructive">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('undo')}</AlertDialogTitle>
          <AlertDialogDescription>{t('undoDescription')}</AlertDialogDescription>
          <AlertDialogDescription asChild>
            <UndoOptionComponent onUndoOptionChange={setUndoOption} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel tone="destructive" onClick={() => setOpen(false)}>
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            tone="destructive"
            loading={loading}
            onClick={e => {
              e.preventDefault()
              undoEdit(edit_id)
            }}
          >
            {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
