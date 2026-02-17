import { $setBlocksType } from '@lexical/selection'
import { $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical'
import { TextIcon } from 'lucide-react'

import { ComponentPickerOption } from '@/components/editor/libs/plugins/picker/component-picker-option'
import { useTranslations } from 'next-intl'

export function ParagraphPickerPlugin() {
  const t = useTranslations('Components.Editor.Picker')
  return new ComponentPickerOption(t('paragraph'), {
    icon: <TextIcon className="size-4" />,
    keywords: ['normal', 'paragraph', 'p', 'text'],
    onSelect: (_, editor) =>
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode())
        }
      }),
  })
}
