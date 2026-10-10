import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

type Change = { add: { id: string; position: number; element: HTMLElement } } | { remove: string }

export const uploadsKey = new PluginKey<DecorationSet>('pictureUploads')

export function uploadsPlugin() {
  return new Plugin<DecorationSet>({
    key: uploadsKey,
    state: {
      init: () => DecorationSet.empty,
      apply(transaction, shown) {
        const mapped = shown.map(transaction.mapping, transaction.doc)
        const change: Change | undefined = transaction.getMeta(uploadsKey)
        if (change === undefined) {
          return mapped
        }
        if ('add' in change) {
          const { id, position, element } = change.add
          const widget = Decoration.widget(position, element, { id, key: id, side: -1 })
          return mapped.add(transaction.doc, [widget])
        }
        return mapped.remove(mapped.find(undefined, undefined, spec => spec.id === change.remove))
      },
    },
    props: {
      decorations: state => uploadsKey.getState(state),
    },
  })
}

export function placeholderPosition(state: EditorState, id: string): number | undefined {
  const shown = uploadsKey.getState(state)
  return shown?.find(undefined, undefined, spec => spec.id === id)[0]?.from
}
