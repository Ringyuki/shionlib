import { INSERT_ORDERED_LIST_COMMAND } from '@lexical/list'
import { ListOrderedIcon } from 'lucide-react'

import { ComponentPickerOption } from '@/components/editor/libs/plugins/picker/component-picker-option'
import { useTranslations } from 'next-intl'

export function NumberedListPickerPlugin() {
  const t = useTranslations('Components.Editor.Picker')
  return new ComponentPickerOption(t('numberedList'), {
    icon: <ListOrderedIcon className="size-4" />,
    keywords: ['numbered list', 'ordered list', 'ol'],
    onSelect: (_, editor) => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  })
}
