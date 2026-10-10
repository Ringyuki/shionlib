import { Extension } from '@tiptap/core'
import type { Fragment, Node as DocumentNode, NodeType, Schema } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { BlockKind, EditorSession, HoveredBlock } from '../session'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockHandle: {
      dragBlock: (position: number, transfer: DataTransfer) => ReturnType
      turnBlockInto: (position: number, kind: BlockKind) => ReturnType
      duplicateBlock: (position: number) => ReturnType
      removeBlock: (position: number) => ReturnType
      addBlockAfter: (position: number) => ReturnType
    }
  }
}

const handleKey = new PluginKey('blockHandle')

const handleMark = '[data-block-handle]'

const handleSize = 24

const convertibles: readonly string[] = [
  'paragraph',
  'heading',
  'blockquote',
  'bullet_list',
  'ordered_list',
]

function linesOf(block: DocumentNode): Fragment[] {
  if (block.isTextblock) {
    return [block.content]
  }
  const lines: Fragment[] = []
  block.descendants(node => {
    if (node.isTextblock) {
      lines.push(node.content)
    }
    return !node.isTextblock
  })
  return lines
}

function listOf(list: NodeType | undefined, item: NodeType | undefined, lines: DocumentNode[]) {
  return list === undefined || item === undefined
    ? undefined
    : [
        list.create(
          null,
          lines.map(line => item.create(null, line)),
        ),
      ]
}

function turned(schema: Schema, kind: BlockKind, lines: Fragment[]): DocumentNode[] | undefined {
  const { paragraph, heading, blockquote, bullet_list, ordered_list, list_item } = schema.nodes
  if (paragraph === undefined) {
    return undefined
  }
  const paragraphs = lines.map(line => paragraph.create(null, line))
  switch (kind) {
    case 'paragraph':
      return paragraphs
    case 'heading2':
      return heading && lines.map(line => heading.create({ level: 2 }, line))
    case 'heading3':
      return heading && lines.map(line => heading.create({ level: 3 }, line))
    case 'bulletList':
      return listOf(bullet_list, list_item, paragraphs)
    case 'orderedList':
      return listOf(ordered_list, list_item, paragraphs)
    case 'blockquote':
      return blockquote && [blockquote.create(null, paragraphs)]
  }
}

function blockAt(view: EditorView, pointerY: number): HoveredBlock | null {
  const surface = view.dom.getBoundingClientRect()
  const found = view.posAtCoords({ left: surface.left + surface.width / 2, top: pointerY })
  if (found === null) {
    return null
  }
  const resolved = view.state.doc.resolve(found.inside >= 0 ? found.inside : found.pos)
  const position = resolved.depth === 0 ? resolved.pos : resolved.before(1)
  const node = view.state.doc.nodeAt(position)
  const element = view.nodeDOM(position)
  if (node === null || !(element instanceof HTMLElement)) {
    return null
  }
  const line = Number.parseFloat(getComputedStyle(element).lineHeight)
  const firstLine = Number.isFinite(line) ? line : handleSize
  return {
    position,
    top: element.offsetTop + Math.max(0, (firstLine - handleSize) / 2),
    convertible: convertibles.includes(node.type.name),
  }
}

function towardsHandle(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(handleMark) !== null
}

export function blockHandle(session: EditorSession) {
  const show = (next: HoveredBlock | null) => {
    const shown = session.block.get()
    if (shown?.position !== next?.position || shown?.top !== next?.top) {
      session.block.set(next)
    }
  }
  return Extension.create({
    name: 'blockHandle',

    addCommands() {
      return {
        dragBlock:
          (position, transfer) =>
          ({ state, view, dispatch }) => {
            const element = view.nodeDOM(position)
            if (dispatch === undefined || !(element instanceof HTMLElement)) {
              return false
            }
            const selection = NodeSelection.create(state.doc, position)
            dispatch(state.tr.setSelection(selection))
            transfer.effectAllowed = 'move'
            transfer.setDragImage(element, 0, 0)
            view.dragging = { slice: selection.content(), move: true }
            return true
          },
        turnBlockInto:
          (position, kind) =>
          ({ state, tr, dispatch }) => {
            const block = state.doc.nodeAt(position)
            if (block === null || !convertibles.includes(block.type.name)) {
              return false
            }
            const nodes = turned(state.schema, kind, linesOf(block))
            if (nodes === undefined) {
              return false
            }
            tr.replaceWith(position, position + block.nodeSize, nodes)
            tr.setSelection(TextSelection.near(tr.doc.resolve(position + 1)))
            dispatch?.(tr)
            return true
          },
        duplicateBlock:
          position =>
          ({ state, tr, dispatch }) => {
            const node = state.doc.nodeAt(position)
            if (node === null) {
              return false
            }
            dispatch?.(tr.insert(position + node.nodeSize, node.copy(node.content)))
            return true
          },
        removeBlock:
          position =>
          ({ state, tr, dispatch }) => {
            const node = state.doc.nodeAt(position)
            if (node === null) {
              return false
            }
            dispatch?.(tr.delete(position, position + node.nodeSize))
            return true
          },
        addBlockAfter:
          position =>
          ({ state, chain }) => {
            const node = state.doc.nodeAt(position)
            if (node === null) {
              return false
            }
            const after = position + node.nodeSize
            return chain()
              .insertContentAt(after, { type: 'paragraph' })
              .focus(after + 1)
              .insertContent('/')
              .run()
          },
      }
    },

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: handleKey,
          props: {
            handleDOMEvents: {
              mousemove(view, event) {
                if (view.editable && session.blockMenu.get() === null) {
                  show(blockAt(view, event.clientY))
                }
                return false
              },
              mouseleave(_, event) {
                if (!towardsHandle(event.relatedTarget) && session.blockMenu.get() === null) {
                  show(null)
                }
                return false
              },
              keydown() {
                show(null)
                return false
              },
            },
          },
        }),
      ]
    },
  })
}
