'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { CLEAR_EDITOR_COMMAND } from 'lexical'
import { Trash2Icon } from 'lucide-react'

import { Button } from '@/components/shionui/Button'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/shionui/AlertDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { useTranslations } from 'next-intl'

export function ClearEditorActionPlugin() {
  const t = useTranslations('Components.Editor.Actions')
  const [editor] = useLexicalComposerContext()

  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button size={'sm'} appearance={'ghost'} className="p-2">
              <Trash2Icon className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('clearEditor')}</TooltipContent>
      </Tooltip>
      <AlertDialogContent tone="destructive">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('clearEditor')}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>{t('clearEditorConfirm')}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel tone="destructive">{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            tone="destructive"
            onClick={() => {
              editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined)
            }}
          >
            {t('clear')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
