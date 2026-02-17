'use client'

import { ImageIcon } from 'lucide-react'

import { useToolbarContext } from '@/components/editor/libs/context/toolbar-context'
import { InsertImageDialog } from '@/components/editor/libs/plugins/images-plugin'
import { SelectItem } from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'

export function InsertImage() {
  const t = useTranslations('Components.Editor.Picker')
  const { activeEditor, showModal } = useToolbarContext()

  return (
    <SelectItem
      value="image"
      onPointerUp={e => {
        showModal(t('insertImage'), onClose => (
          <InsertImageDialog activeEditor={activeEditor} onClose={onClose} />
        ))
      }}
      className=""
    >
      <div className="flex items-center gap-1">
        <ImageIcon className="size-4" />
        <span>{t('image')}</span>
      </div>
    </SelectItem>
  )
}
