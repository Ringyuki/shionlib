import {
  Heading,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  TextQuote,
} from 'lucide-react'
import { insertRule } from '../insert'
import type { EditorPlugin } from '../plugin'

export const heading: EditorPlugin = {
  id: 'heading',
  group: 'style',
  order: 0,
  tool: {
    icon: Heading,
    isActive: editor => editor.isActive('heading'),
    choices: [
      {
        id: 'paragraph',
        shortcut: 'Mod-Alt-0',
        isActive: editor => editor.isActive('paragraph'),
        run: editor => editor.chain().focus().setParagraph().run(),
      },
      {
        id: 'heading2',
        shortcut: 'Mod-Alt-2',
        isActive: editor => editor.isActive('heading', { level: 2 }),
        run: editor => editor.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        id: 'heading3',
        shortcut: 'Mod-Alt-3',
        isActive: editor => editor.isActive('heading', { level: 3 }),
        run: editor => editor.chain().focus().setHeading({ level: 3 }).run(),
      },
    ],
  },
  commands: [
    {
      id: 'paragraph',
      icon: Pilcrow,
      keywords: ['text', 'paragraph', 'p', '正文', '段落', '本文'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      id: 'heading2',
      icon: Heading2,
      typed: '##',
      keywords: ['heading', 'title', 'h2', '标题', '大标题', '見出し'],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
    },
    {
      id: 'heading3',
      icon: Heading3,
      typed: '###',
      keywords: ['heading', 'subheading', 'h3', '标题', '小标题', '小見出し'],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
    },
  ],
}

export const bulletList: EditorPlugin = {
  id: 'bulletList',
  group: 'block',
  order: 1,
  tool: {
    icon: List,
    shortcut: 'Mod-Shift-8',
    isActive: editor => editor.isActive('bullet_list'),
    run: editor => editor.chain().focus().toggleBulletList().run(),
  },
  commands: [
    {
      id: 'bulletList',
      icon: List,
      typed: '-',
      keywords: ['list', 'bullet', 'ul', '列表', '无序列表', '箇条書き'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
  ],
}

export const orderedList: EditorPlugin = {
  id: 'orderedList',
  group: 'block',
  order: 2,
  tool: {
    icon: ListOrdered,
    shortcut: 'Mod-Shift-7',
    isActive: editor => editor.isActive('ordered_list'),
    run: editor => editor.chain().focus().toggleOrderedList().run(),
  },
  commands: [
    {
      id: 'orderedList',
      icon: ListOrdered,
      typed: '1.',
      keywords: ['list', 'ordered', 'number', 'ol', '列表', '有序列表', '番号付きリスト'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
  ],
}

export const blockquote: EditorPlugin = {
  id: 'blockquote',
  group: 'block',
  order: 3,
  tool: {
    icon: TextQuote,
    shortcut: 'Mod-Shift-b',
    isActive: editor => editor.isActive('blockquote'),
    run: editor => editor.chain().focus().toggleBlockquote().run(),
  },
  commands: [
    {
      id: 'blockquote',
      icon: TextQuote,
      typed: '>',
      keywords: ['quote', 'blockquote', '引用'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
  ],
}

export const horizontalRule: EditorPlugin = {
  id: 'horizontalRule',
  group: 'block',
  order: 4,
  tool: { icon: Minus, run: editor => insertRule(editor) },
  commands: [
    {
      id: 'horizontalRule',
      icon: Minus,
      typed: '---',
      keywords: ['rule', 'divider', 'hr', 'line', '分隔线', '分割线', '区切り線'],
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        insertRule(editor)
      },
    },
  ],
}
