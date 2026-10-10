import { getMarkRange, type Editor } from '@tiptap/core'
import { Link } from '@tiptap/extension-link'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { linkAddressFrom } from '~/shared/richtext/rich-text.schema'
import { openLink } from '../plugins/inserts'
import { rangeRect } from '../selection'
import type { EditorSession } from '../session'

const caretKey = new PluginKey('linkAtCaret')

const narrowScreen = '(max-width: 639px)'

type LinkRange = { from: number; to: number; href: string }

function linkAtCaret(state: EditorState): LinkRange | undefined {
  const { selection, schema, doc } = state
  const type = schema.marks.link
  if (!selection.empty || type === undefined) {
    return undefined
  }
  const range = getMarkRange(selection.$from, type)
  if (range === undefined) {
    return undefined
  }
  const mark = doc.nodeAt(range.from)?.marks.find(candidate => candidate.type === type)
  const href = linkAddressFrom(mark?.attrs.href)
  return href === undefined ? undefined : { ...range, href }
}

function awaitingAddress(session: EditorSession): boolean {
  return session.link.get()?.fresh === true
}

export function rangeAwaitingAddress(state: EditorState, session: EditorSession): DecorationSet {
  const { from, to, empty } = state.selection
  if (empty || !awaitingAddress(session)) {
    return DecorationSet.empty
  }
  return DecorationSet.create(state.doc, [Decoration.inline(from, to, { class: 'is-linking' })])
}

function follow(editor: Editor, session: EditorSession): void {
  const shown = session.link.get()
  if (shown?.fresh === true) {
    return
  }
  const found = window.matchMedia(narrowScreen).matches ? undefined : linkAtCaret(editor.state)
  if (found === undefined) {
    session.link.set(null)
    return
  }
  if (shown?.href === found.href) {
    return
  }
  let last = rangeRect(editor, found.from, found.to)
  session.link.set({
    href: found.href,
    fresh: false,
    anchor: {
      contextElement: editor.view.dom,
      getBoundingClientRect: () => {
        const now = linkAtCaret(editor.state)
        if (now !== undefined) {
          last = rangeRect(editor, now.from, now.to)
        }
        return last
      },
    },
  })
}

export function linkMark(session: EditorSession) {
  return Link.extend({
    inclusive: false,

    addAttributes() {
      return { href: { default: null, parseHTML: element => element.getAttribute('href') } }
    },

    addKeyboardShortcuts() {
      return {
        'Mod-k': () => {
          openLink(this.editor, session)
          return true
        },
      }
    },

    addProseMirrorPlugins() {
      const editor = this.editor
      return [
        ...(this.parent?.() ?? []),
        new Plugin({
          key: caretKey,
          view: shown => {
            let marked = awaitingAddress(session)
            const stop = session.link.subscribe(() => {
              if (marked !== awaitingAddress(session)) {
                marked = !marked
                shown.dispatch(shown.state.tr.setMeta(caretKey, marked))
              }
            })
            return {
              update(view, previous) {
                const moved = !view.state.selection.eq(previous.selection)
                if (moved || !view.state.doc.eq(previous.doc)) {
                  follow(editor, session)
                }
              },
              destroy() {
                stop()
                session.link.set(null)
              },
            }
          },
          props: {
            decorations: state => rangeAwaitingAddress(state, session),
            handleClick(view, position, event) {
              if (!event.metaKey && !event.ctrlKey) {
                return false
              }
              const mark = view.state.doc
                .resolve(position)
                .marks()
                .find(candidate => candidate.type.name === 'link')
              const href = linkAddressFrom(mark?.attrs.href)
              if (href === undefined) {
                return false
              }
              window.open(href, '_blank', 'noopener,noreferrer')
              return true
            },
          },
        }),
      ]
    },
  }).configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    defaultProtocol: 'https',
    HTMLAttributes: { target: null, rel: null, class: null },
    isAllowedUri: url => linkAddressFrom(url) !== undefined,
    shouldAutoLink: url => linkAddressFrom(url) !== undefined,
  })
}
