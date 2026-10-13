import { Editor, getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { constraints } from '~/shared/api/generated/constraints'
import type { RichDocument } from '~/shared/richtext/rich-text'
import { documentFrom } from '~/shared/richtext/rich-text.schema'
import { pluginsOf } from '../profiles'
import { createSession } from '../session'
import { extensionsFor } from './extensions'
import { rangeAwaitingAddress } from './link'

const nodeKinds: readonly string[] = constraints.RichTextNode.type.enum

const markKinds: readonly string[] = constraints.RichTextMark.type.enum

const words: RichDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] }],
}

const needsPage: readonly string[] = ['link']

function editorOf(content: RichDocument = words) {
  const session = createSession()
  const extensions = extensionsFor({ plugins: pluginsOf('comment'), session, placeholder: '' })
  return { editor: new Editor({ element: null, extensions, content }), session, extensions }
}

describe('the comment profile', () => {
  it('offers bold, spoiler and link', () => {
    expect(pluginsOf('comment').map(plugin => plugin.id)).toEqual(['bold', 'spoiler', 'link'])
  })

  it('knows every node and mark of the contract and nothing else', () => {
    const schema = getSchema(editorOf().extensions)
    const nodes = Object.keys(schema.nodes).filter(name => name !== 'doc')
    expect(nodes.toSorted()).toEqual(nodeKinds.toSorted())
    expect(Object.keys(schema.marks).toSorted()).toEqual(markKinds.toSorted())
  })

  it('stores what every tool makes in the form the contract describes', () => {
    const { editor, session } = editorOf()
    for (const plugin of pluginsOf('comment').filter(tool => !needsPage.includes(tool.id))) {
      editor.commands.setContent(words)
      editor.commands.selectAll()
      plugin.tool.run(editor, session)
      expect(plugin.tool.isActive(editor), plugin.id).toBe(true)
      expect(documentFrom(editor.getJSON()), plugin.id).toBeDefined()
    }
  })
})

describe('what the editor stores', () => {
  it('keeps a line break inside a paragraph', () => {
    const { editor } = editorOf()
    editor.chain().setTextSelection(6).setHardBreak().run()
    expect(documentFrom(editor.getJSON())?.content[0]?.content?.map(node => node.type)).toEqual([
      'text',
      'hard_break',
      'text',
    ])
  })

  it('keeps a link as its address alone', () => {
    const { editor } = editorOf()
    editor.chain().selectAll().setLink({ href: 'https://example.com/a' }).run()
    const marks = editor.getJSON().content?.[0]?.content?.[0]?.marks
    expect(marks).toEqual([{ type: 'link', attrs: { href: 'https://example.com/a' } }])
  })

  it('marks the text that waits for its address while a new link is entered', () => {
    const { editor, session } = editorOf()
    const marked = () =>
      rangeAwaitingAddress(editor.state, session)
        .find()
        .map(({ from, to }) => [from, to])
    const anchor = {
      getBoundingClientRect: () => {
        throw new Error('the anchor is not measured')
      },
    }
    editor.commands.setTextSelection({ from: 1, to: 6 })
    expect(marked()).toEqual([])
    session.link.set({ anchor, href: '', fresh: true })
    expect(marked()).toEqual([[1, 6]])
    session.link.set({ anchor, href: 'https://example.com', fresh: false })
    expect(marked()).toEqual([])
  })

  it('refuses a link the contract does not allow', () => {
    const { editor } = editorOf()
    editor.chain().selectAll().setLink({ href: 'javascript:alert(1)' }).run()
    expect(editor.isActive('link')).toBe(false)
  })
})
