import { describe, expect, it } from 'vitest'
import { bbcodeSource, type LexicalNode } from './lexical'
import { lexicalDocument } from './lexical-document'
import { lexicalRootFrom } from './lexical.schema'

const text = (value: string, format = 0) => ({
  type: 'text',
  version: 1,
  text: value,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
})

const lineBreak = { type: 'linebreak', version: 1 }

const element = (type: string, children: LexicalNode[], extra: object = {}) => ({
  type,
  version: 1,
  children,
  direction: null,
  format: '',
  indent: 0,
  ...extra,
})

const roundTrip = (source: string) => bbcodeSource(lexicalDocument(source).root)

describe('lexicalDocument', () => {
  it('writes each line as a paragraph of text', () => {
    expect(lexicalDocument('第一行\n第二行').root).toEqual(
      element('root', [
        element('paragraph', [text('第一行')]),
        element('paragraph', [text('第二行')]),
      ]),
    )
  })

  it('keeps a blank line as an empty paragraph', () => {
    expect(lexicalDocument('a\n\nb').root.children).toEqual([
      element('paragraph', [text('a')]),
      element('paragraph', []),
      element('paragraph', [text('b')]),
    ])
  })

  it('turns styles into text formats, also when they nest', () => {
    expect(lexicalDocument('[b]粗[i]斜[/i][/b][s]删[/s][u]线[/u]').root.children).toEqual([
      element('paragraph', [text('粗', 1), text('斜', 3), text('删', 4), text('线', 8)]),
    ])
  })

  it('carries a style over the lines it spans', () => {
    expect(lexicalDocument('[b]一\n二[/b]').root.children).toEqual([
      element('paragraph', [text('一', 1)]),
      element('paragraph', [text('二', 1)]),
    ])
  })

  it('wraps links and spoilers around their text', () => {
    expect(
      lexicalDocument(
        '见 [url=https://example.com/patch]补丁[/url]，[spoiler]她[b]走[/b]了[/spoiler]',
      ).root.children,
    ).toEqual([
      element('paragraph', [
        text('见 '),
        element('link', [text('补丁')], {
          url: 'https://example.com/patch',
          rel: null,
          target: null,
          title: null,
        }),
        text('，'),
        element('spoiler', [text('她'), text('走', 1), text('了')]),
      ]),
    ])
  })

  it('writes a quote as one block whose lines are separated by line breaks', () => {
    expect(lexicalDocument('开头\n[quote]引一\n引二[/quote]\n结尾').root.children).toEqual([
      element('paragraph', [text('开头')]),
      element('quote', [text('引一'), lineBreak, text('引二')]),
      element('paragraph', [text('结尾')]),
    ])
  })

  it('writes headings and lists as blocks of their own, without blank paragraphs around them', () => {
    expect(
      lexicalDocument(
        '前言\n[h2]共通线[/h2]\n[list]\n[*]选 A\n[*][b]选 B[/b]\n[/list]\n[h3]结局[/h3]\n[list=1][*]一[*]二[/list]\n后记',
      ).root.children,
    ).toEqual([
      element('paragraph', [text('前言')]),
      element('heading', [text('共通线')], { tag: 'h2' }),
      element(
        'list',
        [
          element('listitem', [text('选 A')], { value: 1 }),
          element('listitem', [text('选 B', 1)], { value: 2 }),
        ],
        { listType: 'bullet', tag: 'ul', start: 1 },
      ),
      element('heading', [text('结局')], { tag: 'h3' }),
      element(
        'list',
        [
          element('listitem', [text('一')], { value: 1 }),
          element('listitem', [text('二')], { value: 2 }),
        ],
        { listType: 'number', tag: 'ol', start: 1 },
      ),
      element('paragraph', [text('后记')]),
    ])
  })

  it('writes an empty paragraph for nothing', () => {
    expect(lexicalDocument('  \n ').root.children).toEqual([element('paragraph', [])])
  })
})

describe('bbcodeSource', () => {
  it('gives back what was written', () => {
    for (const source of [
      '汉化版装完 v1.02 补丁可以正常进游戏。',
      '第一行\n第二行\n\n第四行',
      '[b]粗[/b]和[i]斜[/i]',
      '见 [url=https://example.com/patch]补丁[/url]',
      '[url]https://example.com[/url]',
      '结局：[spoiler]她走了[/spoiler]',
      '开头\n[quote]引一\n引二[/quote]\n结尾',
      '前言\n[h2]共通线[/h2]\n[list]\n[*]选 A\n[*]选 B\n[/list]\n[h3]结局[/h3]\n[list=1]\n[*]一\n[*]二\n[/list]\n后记',
    ]) {
      expect(roundTrip(source)).toBe(source)
    }
  })

  it('reads what the old editor wrote: paragraphs, headings, links and lists', () => {
    const root: LexicalNode = element('root', [
      element('heading', [text('标题')], { tag: 'h2' }),
      element('paragraph', [text('正文'), lineBreak, text('下一行', 1)]),
      element('paragraph', []),
      element('paragraph', [
        element('autolink', [text('https://example.com')], { url: 'https://example.com' }),
      ]),
      element('list', [element('listitem', [text('一')]), element('listitem', [text('二')])]),
    ])
    expect(bbcodeSource(root)).toBe(
      '[h2]标题[/h2]\n正文\n[b]下一行[/b]\n\n[url]https://example.com[/url]\n[list]\n[*]一\n[*]二\n[/list]',
    )
  })
})

describe('a document that went to the API and came back', () => {
  it('keeps heading levels and the kind of each list', () => {
    const source =
      '[h2]共通线[/h2]\n[list=1]\n[*]一\n[*]二\n[/list]\n[h3]分支[/h3]\n[list]\n[*]甲\n[/list]'
    const stored: unknown = JSON.parse(JSON.stringify(lexicalDocument(source)))
    const root = lexicalRootFrom(stored)
    expect(root === undefined ? undefined : bbcodeSource(root)).toBe(source)
  })
})

describe('lexicalRootFrom', () => {
  it('reads the root of a document and nothing else', () => {
    expect(lexicalRootFrom(lexicalDocument('你好'))?.type).toBe('root')
    expect(lexicalRootFrom(null)).toBeUndefined()
    expect(lexicalRootFrom({ root: 'x' })).toBeUndefined()
    expect(lexicalRootFrom('{"root":{}}')).toBeUndefined()
  })
})
