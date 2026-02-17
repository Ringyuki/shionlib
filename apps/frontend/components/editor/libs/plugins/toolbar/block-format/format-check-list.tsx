import { INSERT_CHECK_LIST_COMMAND } from '@lexical/list'
import { $setBlocksType } from '@lexical/selection'
import { $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical'

import { useToolbarContext } from '@/components/editor/libs/context/toolbar-context'
import { blockTypeToBlockName } from '@/components/editor/libs/plugins/toolbar/block-format/block-format-data'
import { SelectItem } from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'

const BLOCK_FORMAT_VALUE = 'check'

export function FormatCheckList() {
  const t = useTranslations()
  const { activeEditor, blockType } = useToolbarContext()

  const formatParagraph = () => {
    activeEditor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
  }

  const formatCheckList = () => {
    if (blockType !== 'number') {
      activeEditor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
    } else {
      formatParagraph()
    }
  }

  return (
    <SelectItem value={BLOCK_FORMAT_VALUE} onPointerDown={formatCheckList}>
      <div className="flex items-center gap-1 font-normal">
        {blockTypeToBlockName[BLOCK_FORMAT_VALUE].icon}
        {typeof blockTypeToBlockName[BLOCK_FORMAT_VALUE].label === 'function'
          ? (blockTypeToBlockName[BLOCK_FORMAT_VALUE].label as any)(t)
          : blockTypeToBlockName[BLOCK_FORMAT_VALUE].label}
      </div>
    </SelectItem>
  )
}
