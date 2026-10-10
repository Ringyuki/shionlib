import type { AnyExtension, Extensions } from '@tiptap/core'
import { Blockquote } from '@tiptap/extension-blockquote'
import { Bold } from '@tiptap/extension-bold'
import { Document } from '@tiptap/extension-document'
import { HardBreak } from '@tiptap/extension-hard-break'
import { Heading } from '@tiptap/extension-heading'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { Italic } from '@tiptap/extension-italic'
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Strike } from '@tiptap/extension-strike'
import { Text } from '@tiptap/extension-text'
import { Dropcursor, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions'
import { constraints } from '~/shared/api/generated/constraints'
import type { EditorPlugin, PluginId, SlashCommand } from '../plugin'
import type { EditorSession, EngineLabels } from '../session'
import { blockHandle } from './block-handle'
import { imageBlock } from './image-block'
import { linkMark } from './link'
import { slashCommands } from './slash'
import { Spoiler } from './spoiler'
import { tableNodes } from './table'

const listItem = ListItem.extend({ name: 'list_item' }).configure({
  bulletListTypeName: 'bullet_list',
  orderedListTypeName: 'ordered_list',
})

const listKeys = ListKeymap.configure({
  listTypes: [{ itemName: 'list_item', wrapperNames: ['bullet_list', 'ordered_list'] }],
})

const bulletList = BulletList.extend({ name: 'bullet_list' }).configure({
  itemTypeName: 'list_item',
})

const orderedList = OrderedList.extend({
  name: 'ordered_list',
  addAttributes() {
    return {}
  },
}).configure({ itemTypeName: 'list_item' })

function pluginExtensions(id: PluginId, session: EditorSession, labels: EngineLabels): Extensions {
  switch (id) {
    case 'bold':
      return [Bold]
    case 'italic':
      return [Italic]
    case 'strike':
      return [Strike]
    case 'spoiler':
      return [Spoiler]
    case 'heading':
      return [Heading.configure({ levels: [...constraints.RichTextNode.attrs.fields.level.enum] })]
    case 'bulletList':
      return [bulletList, listItem, listKeys]
    case 'orderedList':
      return [orderedList, listItem, listKeys]
    case 'blockquote':
      return [Blockquote]
    case 'horizontalRule':
      return [HorizontalRule.extend({ name: 'horizontal_rule' })]
    case 'link':
      return [linkMark(session)]
    case 'image':
      return [
        imageBlock(session, {
          uploading: labels.uploading,
          failed: labels.uploadFailed,
          retry: labels.retryUpload,
          drop: labels.dropUpload,
        }),
      ]
    case 'table':
      return tableNodes(session, labels)
  }
}

export type ExtensionOptions = {
  plugins: readonly EditorPlugin[]
  commands: readonly SlashCommand[]
  blocks: boolean
  session: EditorSession
  labels: EngineLabels
  placeholder: string
}

export function extensionsFor({
  plugins,
  commands,
  blocks,
  session,
  labels,
  placeholder,
}: ExtensionOptions): Extensions {
  const all: AnyExtension[] = [
    Document,
    Paragraph,
    Text,
    HardBreak.extend({ name: 'hard_break' }),
    UndoRedo,
    Dropcursor,
    Gapcursor,
    Placeholder.configure({ placeholder }),
    ...plugins.flatMap(plugin => pluginExtensions(plugin.id, session, labels)),
    ...(commands.length === 0 ? [] : [slashCommands(commands, session)]),
    ...(blocks ? [blockHandle(session)] : []),
  ]
  const named = new Map(all.map(extension => [extension.name, extension]))
  return [...named.values()]
}
