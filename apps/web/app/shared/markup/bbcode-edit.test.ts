import { describe, expect, it } from 'vitest'
import { applyBBCodeTool } from './bbcode-edit'

describe('applyBBCodeTool', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(applyBBCodeTool({ text: 'a big b', start: 2, end: 5 }, 'bold')).toEqual({
      text: 'a [b]big[/b] b',
      start: 5,
      end: 8,
    })
  })

  it('puts the cursor between the tags when nothing is selected', () => {
    expect(applyBBCodeTool({ text: 'ab', start: 1, end: 1 }, 'spoiler')).toEqual({
      text: 'a[spoiler][/spoiler]b',
      start: 10,
      end: 10,
    })
  })

  it('removes the tags when the selection is already wrapped', () => {
    expect(applyBBCodeTool({ text: 'a [i]x[/i] b', start: 5, end: 6 }, 'italic')).toEqual({
      text: 'a x b',
      start: 2,
      end: 3,
    })
  })

  it('links a selected address directly', () => {
    expect(applyBBCodeTool({ text: 'https://a.example', start: 0, end: 17 }, 'link')).toEqual({
      text: '[url]https://a.example[/url]',
      start: 5,
      end: 22,
    })
  })

  it('leaves the cursor at the address of a labelled link', () => {
    expect(applyBBCodeTool({ text: 'see site', start: 4, end: 8 }, 'link')).toEqual({
      text: 'see [url=]site[/url]',
      start: 9,
      end: 9,
    })
  })

  it('wraps the selection in a heading', () => {
    expect(applyBBCodeTool({ text: '共通线', start: 0, end: 3 }, 'heading')).toEqual({
      text: '[h2]共通线[/h2]',
      start: 4,
      end: 7,
    })
    expect(applyBBCodeTool({ text: '结局', start: 0, end: 2 }, 'subheading').text).toBe(
      '[h3]结局[/h3]',
    )
  })

  it('turns the selected lines into the items of a list', () => {
    expect(applyBBCodeTool({ text: '前\n选 A\n选 B\n后', start: 2, end: 9 }, 'list')).toEqual({
      text: '前\n[list]\n[*]选 A\n[*]选 B\n[/list]\n后',
      start: 12,
      end: 22,
    })
    expect(applyBBCodeTool({ text: '', start: 0, end: 0 }, 'list')).toEqual({
      text: '[list]\n[*]\n[/list]',
      start: 10,
      end: 10,
    })
  })
})
