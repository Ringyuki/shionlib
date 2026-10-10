import { describe, expect, it } from 'vitest'
import {
  blankDocument,
  hasMark,
  inlineRuns,
  isBlank,
  linkOf,
  pictureOf,
  plainText,
  publicText,
  sameDocument,
  sectionsOf,
  textLength,
  type RichNode,
  type RichDocument,
} from './rich-text'
import { linkAddressFrom, documentFrom } from './rich-text.schema'

const text = (value: string, ...marks: NonNullable<RichNode['marks']>): RichNode =>
  marks.length === 0 ? { type: 'text', text: value } : { type: 'text', text: value, marks }

const paragraph = (...content: RichNode[]): RichNode =>
  content.length === 0 ? { type: 'paragraph' } : { type: 'paragraph', content }

const heading = (level: 2 | 3, ...content: RichNode[]): RichNode => ({
  type: 'heading',
  attrs: { level },
  content,
})

const route: RichDocument = {
  type: 'doc',
  content: [
    heading(2, text('Common route')),
    paragraph(text('Pick '), text('A', { type: 'bold' }), { type: 'hard_break' }, text('then B')),
    heading(3, text('  Day '), text('three', { type: 'italic' })),
    {
      type: 'bullet_list',
      content: [
        { type: 'list_item', content: [paragraph(text('go to the beach'))] },
        { type: 'list_item', content: [paragraph(text('she leaves', { type: 'spoiler' }))] },
      ],
    },
    paragraph(),
    { type: 'blockquote', content: [paragraph(text('書音😀'))] },
  ],
}

describe('text of a document', () => {
  it('puts every block and break on its own line', () => {
    expect(plainText(route)).toBe(
      'Common route\nPick A\nthen B\n  Day three\ngo to the beach\nshe leaves\n\n書音😀',
    )
  })

  it('leaves spoilers out of what is shown without asking', () => {
    expect(publicText(route)).toBe(
      'Common route\nPick A\nthen B\n  Day three\ngo to the beach\n\n\n書音😀',
    )
  })

  it('counts what the API counts: the characters of the text, not the breaks', () => {
    expect(textLength(route)).toBe(
      'Common routePick Athen B  Day threego to the beachshe leaves書音😀'.length,
    )
    expect(textLength(blankDocument)).toBe(0)
  })

  it('knows when nothing was written', () => {
    expect(isBlank(blankDocument)).toBe(true)
    expect(isBlank({ type: 'doc', content: [paragraph(text(' 　')), paragraph()] })).toBe(true)
    expect(isBlank(route)).toBe(false)
  })
})

describe('pictures and tables', () => {
  const picture: RichNode = {
    type: 'image_block',
    attrs: { src: 'richtext/7/a.webp', caption: 'The map', width: 800, height: 600 },
  }
  const table: RichNode = {
    type: 'table',
    content: [
      {
        type: 'table_row',
        content: [
          {
            type: 'table_header',
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [paragraph(text('Choice'))],
          },
          {
            type: 'table_cell',
            attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
            content: [paragraph(text('A'))],
          },
        ],
      },
    ],
  }
  const document: RichDocument = { type: 'doc', content: [picture, table] }

  it('reads a picture with what it lacks filled in', () => {
    expect(pictureOf(picture)).toEqual({
      src: 'richtext/7/a.webp',
      alt: '',
      caption: 'The map',
      width: 800,
      height: 600,
      widthPercent: 100,
    })
  })

  it('counts a caption as a line of text and a cell as one too', () => {
    expect(plainText(document)).toBe('The map\nChoice\nA')
    expect(textLength(document)).toBe('ChoiceA'.length)
  })

  it('passes the guard as the contract describes them', () => {
    expect(documentFrom(structuredClone(document))).toEqual(document)
  })
})

describe('sections of a document', () => {
  it('lists the headings in order with the ids the view gives them', () => {
    expect(sectionsOf(route)).toEqual([
      { id: 'section-1', level: 2, title: 'Common route' },
      { id: 'section-2', level: 3, title: 'Day three' },
    ])
    expect(sectionsOf(blankDocument)).toEqual([])
  })
})

describe('marks', () => {
  it('finds a mark and the address of a link', () => {
    const marks = [
      { type: 'bold' },
      { type: 'link', attrs: { href: 'https://a.example' } },
    ] as const
    expect(hasMark(marks, 'bold')).toBe(true)
    expect(hasMark(marks, 'spoiler')).toBe(false)
    expect(hasMark(undefined, 'bold')).toBe(false)
    expect(linkOf(marks)).toBe('https://a.example')
    expect(linkOf([{ type: 'link' }])).toBeUndefined()
    expect(linkOf(undefined)).toBeUndefined()
  })
})

describe('runs of inline nodes', () => {
  it('keeps neighbours with the same key together', () => {
    const nodes = [
      text('a'),
      text('b', { type: 'spoiler' }),
      text('c', { type: 'spoiler' }, { type: 'bold' }),
      text('d'),
      text('e', { type: 'spoiler' }),
    ]
    const runs = inlineRuns(nodes, node => (hasMark(node.marks, 'spoiler') ? 'spoiler' : undefined))
    expect(runs.map(run => [run.key, run.nodes.map(node => node.text).join('')])).toEqual([
      [undefined, 'a'],
      ['spoiler', 'bc'],
      [undefined, 'd'],
      ['spoiler', 'e'],
    ])
    expect(inlineRuns([], () => undefined)).toEqual([])
  })
})

describe('comparing documents', () => {
  it('compares what they say, not which object they are', () => {
    expect(sameDocument(route, structuredClone(route))).toBe(true)
    expect(sameDocument(route, blankDocument)).toBe(false)
  })
})

describe('reading a document from outside', () => {
  it('accepts what the contract describes', () => {
    expect(documentFrom(structuredClone(route))).toEqual(route)
    expect(documentFrom(blankDocument)).toEqual(blankDocument)
  })

  it.each([
    ['nothing', undefined],
    ['text', 'hello'],
    ['the old editor state', { root: { type: 'root', children: [] } }],
    ['another root', { type: 'paragraph', content: [] }],
    ['an unknown node', { type: 'doc', content: [{ type: 'image' }] }],
    ['a node under its editor name', { type: 'doc', content: [{ type: 'hardBreak' }] }],
    [
      'an unknown mark',
      {
        type: 'doc',
        content: [
          paragraph(text('a')),
          { type: 'text', text: 'b', marks: [{ type: 'underline' }] },
        ],
      },
    ],
    ['an unknown field', { type: 'doc', content: [{ type: 'paragraph', style: 'color: red' }] }],
    [
      'an unknown attribute',
      { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' } }] },
    ],
    [
      'a heading level outside the contract',
      { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] },
    ],
  ])('refuses %s', (_, raw) => {
    expect(documentFrom(raw)).toBeUndefined()
  })
})

describe('the address of a link', () => {
  it.each([
    ['https://example.com/a?b=1#c', 'https://example.com/a?b=1#c'],
    ['  http://example.com  ', 'http://example.com/'],
    ['example.com/guide', 'https://example.com/guide'],
    ['https://example.com/a b', 'https://example.com/a%20b'],
    ['mailto:someone@example.com', 'mailto:someone@example.com'],
  ])('takes %s', (raw, address) => {
    expect(linkAddressFrom(raw)).toBe(address)
  })

  it.each([
    ['a script', 'javascript:alert(1)'],
    ['another protocol', 'ftp://example.com/file'],
    ['a data address', 'data:text/html,<b>x</b>'],
    ['words', 'not an address'],
    ['nothing', ''],
    ['no text at all', undefined],
    ['an address beyond the limit', `https://example.com/${'a'.repeat(2000)}`],
  ])('refuses %s', (_, raw) => {
    expect(linkAddressFrom(raw)).toBeUndefined()
  })
})
