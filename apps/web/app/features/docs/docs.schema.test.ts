import { describe, expect, it } from 'vitest'
import { categoryFrom, docFrom, pictureSizeFrom } from './docs.schema'

const ref = { category: 'guides', name: 'download-games' } as const

describe('docFrom', () => {
  it('reads what a document says about itself', () => {
    expect(
      docFrom(ref, {
        title: '如何下载游戏',
        banner: 'https://images.yurari.moe/galgame/10702/8hxs6nc5_2.jpg',
        description: '了解 Shionlib 下载系统',
        date: '2026-02-27',
        order: 1,
        authors: [1, 3625],
      }),
    ).toEqual({
      category: 'guides',
      name: 'download-games',
      title: '如何下载游戏',
      banner: 'https://images.yurari.moe/galgame/10702/8hxs6nc5_2.jpg',
      description: '了解 Shionlib 下载系统',
      date: '2026-02-27',
      order: 1,
      authorIds: [1, 3625],
    })
  })

  it('needs only a title and a date', () => {
    expect(docFrom(ref, { title: 'Title', date: new Date('2025-10-28T00:00:00Z') })).toEqual({
      category: 'guides',
      name: 'download-games',
      title: 'Title',
      banner: undefined,
      description: '',
      date: '2025-10-28',
      order: undefined,
      authorIds: [],
    })
  })

  it('refuses a head without a title or with a date that is none', () => {
    expect(docFrom(ref, { date: '2026-02-27' })).toBeUndefined()
    expect(docFrom(ref, { title: 'Title', date: 'soon' })).toBeUndefined()
    expect(docFrom(ref, { title: 'Title', date: '2026-02-27', order: 'first' })).toBeUndefined()
    expect(docFrom(ref, undefined)).toBeUndefined()
  })

  it('takes the authors by their ids alone, as the page reads the rest from the site', () => {
    const head = { title: 'Title', date: '2026-02-27', authors: [1] }
    expect(docFrom(ref, { ...head, author_uid: 1 })).toBeUndefined()
    expect(docFrom(ref, { ...head, author_name: 'ringyuki' })).toBeUndefined()
    expect(docFrom(ref, { ...head, author_avatar: 'user/1/avatar/a.webp' })).toBeUndefined()
    expect(docFrom(ref, { ...head, authors: [0] })).toBeUndefined()
    expect(docFrom(ref, { ...head, authors: [1.5] })).toBeUndefined()
    expect(docFrom(ref, { ...head, authors: [1, 1] })).toBeUndefined()
    expect(docFrom(ref, { ...head, authors: 1 })).toBeUndefined()
  })
})

describe('categoryFrom', () => {
  it('accepts only the categories documents are kept in', () => {
    expect(categoryFrom('guides')).toBe('guides')
    expect(categoryFrom('faq')).toBeUndefined()
    expect(categoryFrom(undefined)).toBeUndefined()
  })
})

describe('pictureSizeFrom', () => {
  it('reads the size a picture was measured at', () => {
    expect(pictureSizeFrom({ width: 672, height: 908 })).toEqual({ width: 672, height: 908 })
    expect(pictureSizeFrom({ width: '672', height: '908' })).toEqual({ width: 672, height: 908 })
  })

  it('knows no size for a picture that was not measured', () => {
    expect(pictureSizeFrom({ width: undefined, height: undefined })).toBeUndefined()
    expect(pictureSizeFrom({ width: '672px', height: 'auto' })).toBeUndefined()
    expect(pictureSizeFrom({ width: 672, height: 0 })).toBeUndefined()
  })
})
