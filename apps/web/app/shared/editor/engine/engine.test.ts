import { Editor, getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { constraints } from '~/shared/api/generated/constraints'
import type { RichDocument } from '~/shared/richtext/rich-text'
import { documentFrom } from '~/shared/richtext/rich-text.schema'
import { insertRule, insertTable } from '../insert'
import { commandsOf, matchingCommands, movesBlocks, pluginsOf, type Profile } from '../profiles'
import { createSession, type EngineLabels } from '../session'
import { extensionsFor } from './extensions'
import { rangeAwaitingAddress } from './link'

const nodeKinds: readonly string[] = constraints.RichTextNode.type.enum

const markKinds: readonly string[] = constraints.RichTextMark.type.enum

const words: RichDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] }],
}

const needsPage: readonly string[] = ['link', 'image']

const labels: EngineLabels = {
  selectRow: 'row',
  selectColumn: 'column',
  appendRow: 'add row',
  appendColumn: 'add column',
  dragBlock: 'drag',
  addBlock: 'add',
  uploading: percent => `uploading ${percent}`,
  uploadFailed: 'failed',
  retryUpload: 'retry',
  dropUpload: 'drop',
}

const picture = {
  src: 'richtext/1/a.webp',
  alt: '',
  caption: '',
  width: 1200,
  height: 675,
  width_percent: 50,
}

function editorOf(profile: Profile, content: RichDocument = words) {
  const session = createSession()
  const extensions = extensionsFor({
    plugins: pluginsOf(profile),
    commands: commandsOf(profile),
    blocks: movesBlocks(profile),
    session,
    labels,
    placeholder: '',
  })
  return { editor: new Editor({ element: null, extensions, content }), session, extensions }
}

describe.each<Profile>(['comment', 'article'])('the %s profile', profile => {
  it('only knows nodes and marks of the contract', () => {
    const schema = getSchema(editorOf(profile).extensions)
    const nodes = Object.keys(schema.nodes).filter(name => name !== 'doc')
    expect(nodes.filter(name => !nodeKinds.includes(name))).toEqual([])
    expect(Object.keys(schema.marks).filter(name => !markKinds.includes(name))).toEqual([])
  })

  it('stores what every tool makes in the form the contract describes', () => {
    const { editor, session } = editorOf(profile)
    for (const plugin of pluginsOf(profile).filter(tool => !needsPage.includes(tool.id))) {
      editor.commands.setContent(words)
      editor.commands.selectAll()
      const actions = [plugin.tool.run, ...(plugin.tool.choices ?? []).map(choice => choice.run)]
      for (const run of actions) {
        run?.(editor, session)
        expect(documentFrom(editor.getJSON()), plugin.id).toBeDefined()
      }
    }
  })

  it('stores what every slash command makes in the form the contract describes', () => {
    const { editor, session } = editorOf(profile)
    for (const command of commandsOf(profile).filter(item => !needsPage.includes(item.id))) {
      editor.commands.setContent(words)
      command.run(editor, { from: 1, to: 1 }, session)
      expect(documentFrom(editor.getJSON()), command.id).toBeDefined()
    }
  })
})

describe('profiles', () => {
  it('gives comments three tools and no slash commands', () => {
    expect(pluginsOf('comment').map(plugin => plugin.id)).toEqual(['bold', 'spoiler', 'link'])
    expect(commandsOf('comment')).toEqual([])
  })

  it('gives articles every block a walkthrough needs', () => {
    const offered = commandsOf('article').map(command => command.id)
    expect(offered).toEqual([
      'paragraph',
      'heading2',
      'heading3',
      'bulletList',
      'orderedList',
      'blockquote',
      'horizontalRule',
      'image',
      'table',
    ])
  })

  it('puts the text style first in the toolbar and what is inserted last', () => {
    const order = pluginsOf('article').map(plugin => plugin.id)
    expect(order[0]).toBe('heading')
    expect(order.slice(-3)).toEqual(['link', 'image', 'table'])
  })

  it('finds a slash command by a word of any of the three languages', () => {
    const commands = commandsOf('article')
    expect(matchingCommands(commands, '标题').map(command => command.id)).toEqual([
      'heading2',
      'heading3',
    ])
    expect(matchingCommands(commands, 'table').map(command => command.id)).toEqual(['table'])
    expect(matchingCommands(commands, '视频')).toEqual([])
  })
})

describe('what the editor stores', () => {
  it('keeps a link as its address alone', () => {
    const { editor } = editorOf('comment')
    editor.chain().selectAll().setLink({ href: 'https://example.com/a' }).run()
    const marks = editor.getJSON().content?.[0]?.content?.[0]?.marks
    expect(marks).toEqual([{ type: 'link', attrs: { href: 'https://example.com/a' } }])
  })

  it('marks the text that waits for its address while a new link is entered', () => {
    const { editor, session } = editorOf('comment')
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
    const { editor } = editorOf('comment')
    editor.chain().selectAll().setLink({ href: 'javascript:alert(1)' }).run()
    expect(editor.isActive('link')).toBe(false)
  })

  it('keeps a table with a header row and cells of the contract', () => {
    const { editor } = editorOf('article')
    insertTable(editor)
    const stored = documentFrom(editor.getJSON())
    const table = stored?.content.find(node => node.type === 'table')
    expect(table?.content?.map(row => row.content?.map(cell => cell.type))).toEqual([
      ['table_header', 'table_header', 'table_header'],
      ['table_cell', 'table_cell', 'table_cell'],
      ['table_cell', 'table_cell', 'table_cell'],
    ])
    expect(table?.content?.[0]?.content?.[0]?.attrs).toEqual({
      colspan: 1,
      rowspan: 1,
      colwidth: null,
      align: null,
    })
  })

  it('keeps a picture with its size and a rule between paragraphs', () => {
    const { editor } = editorOf('article')
    editor.commands.insertContent({ type: 'image_block', attrs: picture })
    insertRule(editor)
    const stored = documentFrom(editor.getJSON())
    expect(stored?.content.find(node => node.type === 'image_block')?.attrs).toEqual(picture)
    expect(stored?.content.some(node => node.type === 'horizontal_rule')).toBe(true)
  })

  it('aligns the cells of a selected column', () => {
    const { editor } = editorOf('article')
    insertTable(editor)
    editor.chain().setCellAttribute('align', 'center').run()
    const stored = documentFrom(editor.getJSON())
    const table = stored?.content.find(node => node.type === 'table')
    expect(table?.content?.[0]?.content?.[0]?.attrs?.align).toBe('center')
  })

  it('turns, duplicates and removes a block by its position', () => {
    const { editor } = editorOf('article')
    editor.commands.turnBlockInto(0, 'heading2')
    expect(editor.getJSON().content?.[0]?.type).toBe('heading')
    editor.commands.duplicateBlock(0)
    expect(editor.getJSON().content).toHaveLength(2)
    editor.commands.removeBlock(0)
    expect(editor.getJSON().content).toHaveLength(1)
    editor.commands.turnBlockInto(0, 'bulletList')
    expect(documentFrom(editor.getJSON())?.content[0]?.type).toBe('bullet_list')
  })

  it('turns a list or a quote into another kind of block, and leaves a picture as it is', () => {
    const { editor } = editorOf('article')
    const kinds = () => documentFrom(editor.getJSON())?.content.map(node => node.type)
    editor.commands.turnBlockInto(0, 'bulletList')
    editor.commands.turnBlockInto(0, 'blockquote')
    expect(kinds()).toEqual(['blockquote'])
    editor.commands.turnBlockInto(0, 'orderedList')
    expect(kinds()).toEqual(['ordered_list'])
    editor.commands.turnBlockInto(0, 'heading3')
    expect(kinds()).toEqual(['heading'])
    editor.commands.turnBlockInto(0, 'paragraph')
    expect(documentFrom(editor.getJSON())).toEqual(words)
    editor.commands.insertContentAt(0, { type: 'image_block', attrs: picture })
    expect(editor.commands.turnBlockInto(0, 'paragraph')).toBe(false)
    expect(kinds()?.[0]).toBe('image_block')
  })

  it('turns a quote or a list that stands between other blocks', () => {
    const line = (text: string) => ({
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text }],
    })
    const item = (text: string) => ({ type: 'list_item' as const, content: [line(text)] })
    const { editor } = editorOf('article', {
      type: 'doc',
      content: [
        line('before'),
        { type: 'ordered_list', content: [item('one'), item('two')] },
        { type: 'blockquote', content: [line('quoted'), line('twice')] },
        line('after'),
      ],
    })
    const kinds = () => documentFrom(editor.getJSON())?.content.map(node => node.type)
    const place = (index: number) => {
      let position = 0
      editor.state.doc.forEach((_, offset, at) => {
        if (at === index) {
          position = offset
        }
      })
      return position
    }
    expect(editor.commands.turnBlockInto(place(2), 'bulletList')).toBe(true)
    expect(kinds()).toEqual(['paragraph', 'ordered_list', 'bullet_list', 'paragraph'])
    expect(editor.commands.turnBlockInto(place(1), 'paragraph')).toBe(true)
    expect(kinds()).toEqual(['paragraph', 'paragraph', 'paragraph', 'bullet_list', 'paragraph'])
    expect(editor.getText()).toContain('quoted')
  })

  it('does not take pictures or tables into a comment', () => {
    const { editor } = editorOf('comment')
    expect(editor.schema.nodes.image_block).toBeUndefined()
    expect(editor.schema.nodes.table).toBeUndefined()
  })
})
