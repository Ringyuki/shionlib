import { describe, expect, it } from 'vitest'
import { bbcodePlainText, bbcodeSections, parseBBCode } from './bbcode'

const text = (value: string) => ({ kind: 'text', text: value })

describe('parseBBCode', () => {
  it('keeps text without tags as one node', () => {
    expect(parseBBCode('Can/need汉化组\n更新补丁')).toEqual([text('Can/need汉化组\n更新补丁')])
  })

  it('links bare and labelled web addresses', () => {
    expect(parseBBCode('[url]https://a.example/x?y=1[/url]')).toEqual([
      {
        kind: 'link',
        href: 'https://a.example/x?y=1',
        children: [text('https://a.example/x?y=1')],
      },
    ])
    expect(parseBBCode('[URL=https://a.example]site[/URL]')).toEqual([
      { kind: 'link', href: 'https://a.example', children: [text('site')] },
    ])
  })

  it('resolves VNDB entry references against vndb.org', () => {
    expect(parseBBCode('[url=/c161706]Houzuki Enju[/url]')).toEqual([
      { kind: 'link', href: 'https://vndb.org/c161706', children: [text('Houzuki Enju')] },
    ])
  })

  it('keeps square brackets that are not tags', () => {
    expect(parseBBCode('[Translated from [url=https://a.example]Official website[/url]]')).toEqual([
      text('[Translated from '),
      { kind: 'link', href: 'https://a.example', children: [text('Official website')] },
      text(']'),
    ])
  })

  it('drops links that are not web addresses but keeps their label', () => {
    expect(parseBBCode('[url=javascript:alert(1)]x[/url]')).toEqual([text('x')])
    expect(parseBBCode('[url]not a link[/url]')).toEqual([text('not a link')])
  })

  it('nests styles and treats mask as a spoiler', () => {
    expect(parseBBCode('[b]a[i]b[/i][/b][mask]c[/mask]')).toEqual([
      {
        kind: 'style',
        style: 'bold',
        children: [text('a'), { kind: 'style', style: 'italic', children: [text('b')] }],
      },
      { kind: 'style', style: 'spoiler', children: [text('c')] },
    ])
  })

  it('renders unbalanced tags as text', () => {
    expect(parseBBCode('[b]open')).toEqual([text('[b]open')])
    expect(parseBBCode('stray[/b]')).toEqual([text('stray[/b]')])
    expect(parseBBCode('[b][i]x[/b]')).toEqual([
      { kind: 'style', style: 'bold', children: [text('[i]x')] },
    ])
    expect(parseBBCode('[b=1]x[/b]')).toEqual([text('[b=1]x[/b]')])
  })

  it('unwraps size and colour', () => {
    expect(parseBBCode('[size=18]big[/size] [color=#f00]red[/color]')).toEqual([text('big red')])
  })

  it('trims the line breaks that surround a quote', () => {
    expect(parseBBCode('a\r\n[quote]\nq\n[/quote]\nb')).toEqual([
      text('a\n'),
      { kind: 'style', style: 'quote', children: [text('q')] },
      text('b'),
    ])
  })
})

describe('blocks', () => {
  it('reads headings of two levels and drops the line break that follows them', () => {
    expect(parseBBCode('[h2]共通线[/h2]\n正文\n[h3]结局[/h3]')).toEqual([
      { kind: 'heading', level: 2, children: [{ kind: 'text', text: '共通线' }] },
      { kind: 'text', text: '正文\n' },
      { kind: 'heading', level: 3, children: [{ kind: 'text', text: '结局' }] },
    ])
  })

  it('reads the items of a list, ordered when it says so', () => {
    expect(parseBBCode('[list]\n[*]选 A\n[*][b]选 B[/b]\n[/list]')).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [
          [{ kind: 'text', text: '选 A' }],
          [{ kind: 'style', style: 'bold', children: [{ kind: 'text', text: '选 B' }] }],
        ],
      },
    ])
    expect(parseBBCode('[list=1][*]一[*]二[/list]')).toMatchObject([
      { kind: 'list', ordered: true, items: [[{ text: '一' }], [{ text: '二' }]] },
    ])
  })

  it('keeps an item marker outside a list, and a list without items, as text or nothing', () => {
    expect(parseBBCode('[*] 不是列表')).toEqual([{ kind: 'text', text: '[*] 不是列表' }])
    expect(parseBBCode('[list]\n[/list]')).toEqual([])
  })

  it('names the sections of a text by its top headings', () => {
    expect(
      bbcodeSections(
        parseBBCode('[h2]共通线[/h2]\n[quote][h2]引用里的[/h2][/quote]\n[h3][b]结局[/b] 一[/h3]'),
      ),
    ).toEqual([
      { id: 'section-1', level: 2, title: '共通线' },
      { id: 'section-2', level: 3, title: '结局 一' },
    ])
  })
})

describe('bbcodePlainText', () => {
  it('keeps the words and leaves spoilers out', () => {
    expect(bbcodePlainText('a [spoiler]secret[/spoiler] [url=/c1]b[/url] [b]c[/b]')).toBe('a  b c')
  })
})
