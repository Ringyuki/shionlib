import { $createQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $getSelection, $isRangeSelection } from 'lexical'
import { QuoteIcon } from 'lucide-react'

import { ComponentPickerOption } from '@/components/editor/libs/plugins/picker/component-picker-option'
import { useTranslations } from 'next-intl'

export function QuotePickerPlugin() {
  const t = useTranslations('Components.Editor.Picker')
  return new ComponentPickerOption(t('quote'), {
    icon: <QuoteIcon className="size-4" />,
    keywords: ['block quote'],
    onSelect: (_, editor) =>
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode())
        }
      }),
  })
}
