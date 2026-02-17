'use client'

import { Button } from '@/components/shionui/Button'
import { Trash } from 'lucide-react'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'
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

interface DeleteProps {
  id: number
  game_id: number
  onSuccess: (id: number) => void
}

export const Delete = ({ id, game_id, onSuccess }: DeleteProps) => {
  const t = useTranslations('Components.Game.Edit.Developer.Delete')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  if (!id) return null

  const handleDelete = async () => {
    try {
      setLoading(true)
      await shionlibRequest().delete(`/game/${game_id}/edit/developers`, {
        data: {
          ids: [id],
        },
      })
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
        loading={loading}
      >
        {t('delete')}
      </Button>
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
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
