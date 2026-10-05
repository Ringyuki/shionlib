import { describe, expect, it } from 'vitest'
import { bbcodePlainText, parseBBCode } from './bbcode'

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

describe('bbcodePlainText', () => {
  it('keeps the words and leaves spoilers out', () => {
    expect(bbcodePlainText('a [spoiler]secret[/spoiler] [url=/c1]b[/url] [b]c[/b]')).toBe('a  b c')
  })
})
