'use client'

import { useCallback, useState } from 'react'
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection'
import { $getSelection, $isRangeSelection, BaseSelection } from 'lexical'
import { PaintBucketIcon } from 'lucide-react'

import { useToolbarContext } from '@/components/editor/libs/context/toolbar-context'
import { useUpdateToolbarHandler } from '@/components/editor/libs/editor-hooks/use-update-toolbar'
import ColorPicker from '@/components/editor/libs/editor-ui/colorpicker'
import { useTranslations } from 'next-intl'

export function FontBackgroundToolbarPlugin() {
  const t = useTranslations('Components.Editor.Toolbar')
  const { activeEditor } = useToolbarContext()

  const [bgColor, setBgColor] = useState('#fff')

  const $updateToolbar = (selection: BaseSelection) => {
    if ($isRangeSelection(selection)) {
      setBgColor($getSelectionStyleValueForProperty(selection, 'background-color', '#fff'))
    }
  }

  useUpdateToolbarHandler($updateToolbar)

  const applyStyleText = useCallback(
    (styles: Record<string, string>, skipHistoryStack?: boolean) => {
      activeEditor.update(
        () => {
          const selection = $getSelection()
          if (selection !== null) {
            $patchStyleText(selection, styles)
          }
        },
        skipHistoryStack ? { tag: 'historic' } : {},
      )
    },
    [activeEditor],
  )

  const onBgColorSelect = useCallback(
    (value: string, skipHistoryStack: boolean) => {
      applyStyleText({ 'background-color': value }, skipHistoryStack)
    },
    [applyStyleText],
  )

  return (
    <ColorPicker
      icon={<PaintBucketIcon className="size-4" />}
      color={bgColor}
      onChange={onBgColorSelect}
      title={t('textBackgroundColor')}
    />
  )
}
