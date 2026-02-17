import { INSERT_CHECK_LIST_COMMAND } from '@lexical/list'
import { ListTodoIcon } from 'lucide-react'

import { ComponentPickerOption } from '@/components/editor/libs/plugins/picker/component-picker-option'
import { useTranslations } from 'next-intl'

export function CheckListPickerPlugin() {
  const t = useTranslations('Components.Editor.Picker')
  return new ComponentPickerOption(t('checkList'), {
    icon: <ListTodoIcon className="size-4" />,
    keywords: ['check list', 'todo list'],
    onSelect: (_, editor) => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
  })
}
