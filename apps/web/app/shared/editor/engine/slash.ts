import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Suggestion, type SuggestionProps } from '@tiptap/suggestion'
import type { SlashCommand } from '../plugin'
import { matchingCommands } from '../profiles'
import type { EditorSession } from '../session'

const slashKey = new PluginKey('slashCommands')

export function slashCommands(commands: readonly SlashCommand[], session: EditorSession) {
  const show = (props: SuggestionProps<SlashCommand>) => {
    session.commands.set({
      anchor: {
        contextElement: props.editor.view.dom,
        getBoundingClientRect: () => props.clientRect?.() ?? new DOMRect(),
      },
      items: props.items,
      query: props.query,
      index: 0,
      choose: index => {
        const chosen = props.items[index]
        if (chosen !== undefined) {
          props.command(chosen)
        }
      },
    })
  }
  const step = (by: number) => {
    const menu = session.commands.get()
    if (menu !== null && menu.items.length > 0) {
      const count = menu.items.length
      session.commands.set({ ...menu, index: (menu.index + by + count) % count })
    }
  }
  return Extension.create({
    name: 'slashCommands',

    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommand>({
          editor: this.editor,
          char: '/',
          pluginKey: slashKey,
          items: ({ query }) => matchingCommands(commands, query),
          command: ({ editor, range, props }) => props.run(editor, range, session),
          render: () => ({
            onStart: show,
            onUpdate: show,
            onExit: () => session.commands.set(null),
            onKeyDown: ({ event }) => {
              const menu = session.commands.get()
              if (menu === null) {
                return false
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                step(event.key === 'ArrowDown' ? 1 : -1)
                return true
              }
              if (event.key === 'Enter') {
                menu.choose(menu.index)
                return true
              }
              if (event.key === 'Escape') {
                session.commands.set(null)
                return true
              }
              return false
            },
          }),
        }),
      ]
    },
  })
}
