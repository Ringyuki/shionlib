import { Columns3Icon } from 'lucide-react'

import { InsertLayoutDialog } from '@/components/editor/libs/plugins/layout-plugin'
import { ComponentPickerOption } from '@/components/editor/libs/plugins/picker/component-picker-option'
import { useTranslations } from 'next-intl'

export function ColumnsLayoutPickerPlugin() {
  const t = useTranslations('Components.Editor.Picker')
  return new ComponentPickerOption(t('columnsLayout'), {
    icon: <Columns3Icon className="size-4" />,
    keywords: ['columns', 'layout', 'grid'],
    onSelect: (_, editor, showModal) =>
      showModal(t('insertColumnsLayout'), onClose => (
        <InsertLayoutDialog activeEditor={editor} onClose={onClose} />
      )),
  })
}
