import { describe, expect, it } from 'bun:test'
import {
  developerCollection,
  homeView,
  profileView,
  translatorCollection,
} from '../../src/cards/collection'
import type { GameList } from '../../src/services/catalog'

const works = (count: number, total = count): GameList => ({
  items: Array.from({ length: count }, (_, index) => ({
    id: index,
    title_zh: '',
    title_jp: `${index}`,
    title_en: '',
    covers:
      index === 1
        ? []
        : [
            {
              type: 'dig',
              url: `https://images.example/${index}.webp`,
              dims: [500, 700],
              sexual: 0,
              violence: 0,
              masked: false,
            },
          ],
  })),
  meta: { totalItems: total },
})

describe('collections', () => {
  it('lists a developer with its aliases, its number of works and five covers', () => {
    const view = developerCollection(
      { name: 'ゆずソフト', aliases: ['Yuzusoft', '柚子社'], logo: 'developer/1/logo.webp' },
      works(8, 13),
      'zh',
    )
    expect(view.subtitle).toBe('Yuzusoft、柚子社 · 13 部作品')
    expect(view.logo).toBe('https://t.shionlib.com/developer/1/logo.webp')
    expect(view.shelf.map(cover => cover.src)).toEqual([
      'https://images.example/0.webp',
      'https://images.example/2.webp',
      'https://images.example/3.webp',
      'https://images.example/4.webp',
      'https://images.example/5.webp',
    ])
  })

  it('counts a translator by the works a visitor can see', () => {
    const view = translatorCollection({ name: '心愿屋汉化组', aliases: [] }, works(3, 49), 'en')
    expect(view.subtitle).toBe('49 works')
    expect(view.logo).toBeUndefined()
  })

  it('fills the home page with six covers', () => {
    expect(homeView(works(12)).shelf).toHaveLength(6)
  })
})

describe('profileView', () => {
  it('marks a sponsor and an admin and counts what the user published', () => {
    const view = profileView(
      {
        name: 'ringyuki',
        avatar: 'user/1/avatar/a.webp',
        cover: null,
        bio: 'この大空に、\n翼をひろげて。',
        is_admin: true,
        is_sponsor: true,
        resource_count: 3444,
        comment_count: 13,
        walkthrough_count: 1,
      },
      'zh',
    )
    expect(view.marks).toEqual([
      { label: '赞助者', tone: 'accent' },
      { label: '管理员', tone: 'neutral' },
    ])
    expect(view.bio).toBe('この大空に、 翼をひろげて。')
    expect(view.cover).toBeUndefined()
    expect(view.stats).toEqual([
      { label: '上传', value: 3444 },
      { label: '评论', value: 13 },
      { label: '攻略', value: 1 },
    ])
  })
})
