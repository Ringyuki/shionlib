'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { sileo } from 'sileo'
import { Trash2 } from 'lucide-react'
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
import { shionlibRequest } from '@/utils/request'

interface GamePVNRemoveProps {
  gameId: number
  onRemoved: () => void
}

export const GamePVNRemove = ({ gameId, onRemoved }: GamePVNRemoveProps) => {
  const t = useTranslations('Components.Game.PVN')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRemove = async () => {
    setLoading(true)
    try {
      await shionlibRequest().delete(`/potatovn/game/${gameId}`)
      sileo.success({ title: t('removeSuccess') })
      onRemoved()
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
        variant="destructive"
      >
        <DropdownMenuLabel>{t('remove')}</DropdownMenuLabel>
        <DropdownMenuShortcut>
          <Trash2 className="text-red-500" />
        </DropdownMenuShortcut>
      </DropdownMenuItem>
      <AlertDialog open={open} onOpenChange={setOpen} countdown={15}>
        <AlertDialogContent tone="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle tone="destructive">{t('removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('removeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('removeCancel')}</AlertDialogCancel>
            <AlertDialogAction
              tone="destructive"
              loading={loading}
              onClick={e => {
                handleRemove()
                e.preventDefault()
              }}
            >
              {t('removeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
