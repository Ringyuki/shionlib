'use client'

import { INSERT_EMBED_COMMAND } from '@lexical/react/LexicalAutoEmbedPlugin'

import { useToolbarContext } from '@/components/editor/libs/context/toolbar-context'
import { EmbedConfigs } from '@/components/editor/libs/plugins/embeds/auto-embed-plugin'
import { SelectItem } from '@/components/shionui/Select'

export function InsertEmbeds() {
  const { activeEditor } = useToolbarContext()
  return EmbedConfigs.map(embedConfig => (
    <SelectItem
      key={embedConfig.type}
      value={embedConfig.type}
      onPointerUp={() => {
        activeEditor.dispatchCommand(INSERT_EMBED_COMMAND, embedConfig.type)
      }}
      className=""
    >
      <div className="flex items-center gap-1">
        {embedConfig.icon}
        <span>{embedConfig.contentName}</span>
      </div>
    </SelectItem>
  ))
}
