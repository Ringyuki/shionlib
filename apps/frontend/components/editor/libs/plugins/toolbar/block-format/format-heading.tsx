import { $createHeadingNode, HeadingTagType } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $getSelection } from 'lexical'

import { useToolbarContext } from '@/components/editor/libs/context/toolbar-context'
import { blockTypeToBlockName } from '@/components/editor/libs/plugins/toolbar/block-format/block-format-data'
import { SelectItem } from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'

export function FormatHeading({ levels = [] }: { levels: HeadingTagType[] }) {
  const t = useTranslations()
  const { activeEditor, blockType } = useToolbarContext()

  const formatHeading = (headingSize: HeadingTagType) => {
    if (blockType !== headingSize) {
      activeEditor.update(() => {
        const selection = $getSelection()
        $setBlocksType(selection, () => $createHeadingNode(headingSize))
      })
    }
  }

  return levels.map(level => (
    <SelectItem key={level} value={level} onPointerDown={() => formatHeading(level)}>
      <div className="flex items-center gap-1 font-normal">
        {blockTypeToBlockName[level].icon}
        {typeof blockTypeToBlockName[level].label === 'function'
          ? (blockTypeToBlockName[level].label as any)(t)
          : blockTypeToBlockName[level].label}
      </div>
    </SelectItem>
  ))
}
