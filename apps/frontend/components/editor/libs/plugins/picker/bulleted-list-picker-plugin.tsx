import { INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { ListIcon } from 'lucide-react'

import { ComponentPickerOption } from '@/components/editor/libs/plugins/picker/component-picker-option'
import { useTranslations } from 'next-intl'

export function BulletedListPickerPlugin() {
  const t = useTranslations('Components.Editor.Picker')
  return new ComponentPickerOption(t('bulletedList'), {
    icon: <ListIcon className="size-4" />,
    keywords: ['bulleted list', 'unordered list', 'ul'],
    onSelect: (_, editor) => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
  })
}
