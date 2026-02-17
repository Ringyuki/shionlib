import { $createQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $getSelection } from 'lexical'

import { useToolbarContext } from '@/components/editor/libs/context/toolbar-context'
import { blockTypeToBlockName } from '@/components/editor/libs/plugins/toolbar/block-format/block-format-data'
import { SelectItem } from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'

const BLOCK_FORMAT_VALUE = 'quote'

export function FormatQuote() {
  const t = useTranslations()
  const { activeEditor, blockType } = useToolbarContext()

  const formatQuote = () => {
    if (blockType !== 'quote') {
      activeEditor.update(() => {
        const selection = $getSelection()
        $setBlocksType(selection, () => $createQuoteNode())
      })
    }
  }

  return (
    <SelectItem value="quote" onPointerDown={formatQuote}>
      <div className="flex items-center gap-1 font-normal">
        {blockTypeToBlockName[BLOCK_FORMAT_VALUE].icon}
        {typeof blockTypeToBlockName[BLOCK_FORMAT_VALUE].label === 'function'
          ? (blockTypeToBlockName[BLOCK_FORMAT_VALUE].label as any)(t)
          : blockTypeToBlockName[BLOCK_FORMAT_VALUE].label}
      </div>
    </SelectItem>
  )
}
