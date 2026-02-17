import { ImageIcon } from 'lucide-react'

import { InsertImageDialog } from '@/components/editor/libs/plugins/images-plugin'
import { ComponentPickerOption } from '@/components/editor/libs/plugins/picker/component-picker-option'
import { useTranslations } from 'next-intl'

export function ImagePickerPlugin() {
  const t = useTranslations('Components.Editor.Picker')
  return new ComponentPickerOption(t('image'), {
    icon: <ImageIcon className="size-4" />,
    keywords: ['image', 'photo', 'picture', 'file'],
    onSelect: (_, editor, showModal) =>
      showModal(t('insertImage'), onClose => (
        <InsertImageDialog activeEditor={editor} onClose={onClose} />
      )),
  })
}
