import { describe, expect, it } from 'vitest'
import {
  blankDocument,
  documentOfText,
  hasMark,
  inlineRuns,
  isBlank,
  linkOf,
  plainText,
  publicText,
  sameDocument,
  textLength,
  type RichNode,
  type RichDocument,
} from './rich-text'
import { linkAddressFrom, documentFrom } from './rich-text.schema'

const text = (value: string, ...marks: NonNullable<RichNode['marks']>): RichNode =>
  marks.length === 0 ? { type: 'text', text: value } : { type: 'text', text: value, marks }

const paragraph = (...content: RichNode[]): RichNode =>
  content.length === 0 ? { type: 'paragraph' } : { type: 'paragraph', content }

const impression: RichDocument = {
  type: 'doc',
  content: [
    paragraph(text('Pick '), text('A', { type: 'bold' }), { type: 'hard_break' }, text('then B')),
    paragraph(
      text('  see '),
      text('the guide', { type: 'link', attrs: { href: 'https://a.example' } }),
    ),
    paragraph(text('she leaves', { type: 'spoiler' })),
    paragraph(),
    paragraph(text('書音😀')),
  ],
}

describe('text of a document', () => {
  it('puts every paragraph and break on its own line', () => {
    expect(plainText(impression)).toBe('Pick A\nthen B\n  see the guide\nshe leaves\n\n書音😀')
  })

  it('leaves spoilers out of what is shown without asking', () => {
    expect(publicText(impression)).toBe('Pick A\nthen B\n  see the guide\n\n\n書音😀')
  })

  it('knows when nothing was written', () => {
    expect(isBlank(blankDocument)).toBe(true)
    expect(isBlank({ type: 'doc', content: [paragraph(text(' 　')), paragraph()] })).toBe(true)
    expect(isBlank(impression)).toBe(false)
  })
})

describe('length of a document', () => {
  it('counts the characters of its text the way the API does, without breaks', () => {
    expect(textLength(impression)).toBe('Pick Athen B  see the guideshe leaves書音😀'.length)
    expect(textLength(blankDocument)).toBe(0)
  })
})

describe('a document of plain text', () => {
  it('keeps every line, with breaks between them, in one paragraph', () => {
    expect(documentOfText('汉化组\n\nv1.2')).toEqual({
      type: 'doc',
      content: [
        paragraph(text('汉化组'), { type: 'hard_break' }, { type: 'hard_break' }, text('v1.2')),
      ],
    })
    expect(documentOfText('')).toEqual(blankDocument)
    expect(plainText(documentOfText('a\nb'))).toBe('a\nb')
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
    expect(sameDocument(impression, structuredClone(impression))).toBe(true)
    expect(sameDocument(impression, blankDocument)).toBe(false)
  })
})

describe('reading a document from outside', () => {
  it('accepts what the contract describes', () => {
    expect(documentFrom(structuredClone(impression))).toEqual(impression)
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
    ['a heading', { type: 'doc', content: [{ type: 'heading', content: [text('a')] }] }],
    [
      'a mark the contract dropped',
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'a', marks: [{ type: 'italic' }] }],
          },
        ],
      },
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
