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
        author_uid: 1,
        author_name: 'ringyuki',
        author_avatar: 'https://t.shionlib.com/user/1/avatar/a.webp',
      }),
    ).toEqual({
      category: 'guides',
      name: 'download-games',
      title: '如何下载游戏',
      banner: 'https://images.yurari.moe/galgame/10702/8hxs6nc5_2.jpg',
      description: '了解 Shionlib 下载系统',
      date: '2026-02-27',
      order: 1,
      author: { id: 1, name: 'ringyuki', avatar: 'https://t.shionlib.com/user/1/avatar/a.webp' },
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
      author: undefined,
    })
  })

  it('refuses a head without a title or with a date that is none', () => {
    expect(docFrom(ref, { date: '2026-02-27' })).toBeUndefined()
    expect(docFrom(ref, { title: 'Title', date: 'soon' })).toBeUndefined()
    expect(docFrom(ref, { title: 'Title', date: '2026-02-27', order: 'first' })).toBeUndefined()
    expect(docFrom(ref, undefined)).toBeUndefined()
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
