'use client'

import { useState } from 'react'
import { $isTableSelection } from '@lexical/table'
import { $isRangeSelection, BaseSelection, FORMAT_TEXT_COMMAND } from 'lexical'
import { SubscriptIcon, SuperscriptIcon } from 'lucide-react'

import { useToolbarContext } from '@/components/editor/libs/context/toolbar-context'
import { useUpdateToolbarHandler } from '@/components/editor/libs/editor-hooks/use-update-toolbar'
import { ToggleGroup, ToggleGroupItem } from '@/components/shionui/animated/ToggleGroup'
import { useTranslations } from 'next-intl'

export function SubSuperToolbarPlugin() {
  const t = useTranslations('Components.Editor.Toolbar')
  const { activeEditor } = useToolbarContext()
  const [isSubscript, setIsSubscript] = useState(false)
  const [isSuperscript, setIsSuperscript] = useState(false)

  const $updateToolbar = (selection: BaseSelection) => {
    if ($isRangeSelection(selection) || $isTableSelection(selection)) {
      setIsSubscript(selection.hasFormat('subscript'))
      setIsSuperscript(selection.hasFormat('superscript'))
    }
  }

  useUpdateToolbarHandler($updateToolbar)

  return (
    <ToggleGroup
      type="single"
      value={isSubscript ? 'subscript' : isSuperscript ? 'superscript' : undefined}
      onValueChange={next => {
        if (next === 'subscript') {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')
          return
        }
        if (next === 'superscript') {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')
          return
        }
        if (!next) {
          if (isSubscript) activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')
          else if (isSuperscript) activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')
        }
      }}
    >
      <ToggleGroupItem
        value="subscript"
        size="sm"
        aria-label={t('toggleSubscript')}
        variant={'outline'}
      >
        <SubscriptIcon className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="superscript"
        size="sm"
        aria-label={t('toggleSuperscript')}
        variant={'outline'}
      >
        <SuperscriptIcon className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
