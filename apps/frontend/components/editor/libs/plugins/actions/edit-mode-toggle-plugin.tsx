'use client'

import { useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LockIcon, UnlockIcon } from 'lucide-react'

import { Button } from '@/components/shionui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { useTranslations } from 'next-intl'

export function EditModeTogglePlugin() {
  const t = useTranslations('Components.Editor.Actions')
  const [editor] = useLexicalComposerContext()
  const [isEditable, setIsEditable] = useState(() => editor.isEditable())

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          appearance={'ghost'}
          onClick={() => {
            editor.setEditable(!editor.isEditable())
            setIsEditable(editor.isEditable())
          }}
          title="Read-Only Mode"
          aria-label={`${!isEditable ? 'Unlock' : 'Lock'} read-only mode`}
          size={'sm'}
          className="p-2"
        >
          {isEditable ? <LockIcon className="size-4" /> : <UnlockIcon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isEditable ? t('viewOnlyMode') : t('editMode')}</TooltipContent>
    </Tooltip>
  )
}
