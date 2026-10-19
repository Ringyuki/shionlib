import { describe, expect, it } from 'vitest'
import { messages } from '~/messages/zh'
import type { GameDetails, GameHeader } from './game'
import { gameHead } from './game.seo'

const header: GameHeader = {
  id: 962,
  v_id: 'v56650',
  b_id: '561526',
  h_id: 1041,
  extra_info: [],
  title_jp: 'ライムライト・レモネードジャム',
  title_zh: '橘光柠水随想曲',
  title_en: '',
  aliases: ['LLLJ'],
  covers: [
    {
      language: 'unknown',
      type: 'dig',
      url: 'https://images.example/cover.webp',
      dims: [500, 709],
      thumb_hash: null,
      sexual: 0,
      violence: 0,
      masked: false,
    },
  ],
  developers: [{ role: '开发', developer: { id: 5135, name: 'ゆずソフト', aliases: ['柚子社'] } }],
  release_date: '2025-09-26T00:00:00.000Z',
  release_date_tba: false,
  type: null,
  platform: ['win'],
  content_limit: 0,
}

const details: GameDetails = {
  id: 962,
  extra_info: [],
  tags: [],
  intro_jp: '音楽、仲間、そして恋。',
  intro_zh: '音乐、伙伴，以及爱情。',
  intro_en: '',
  images: [],
  staffs: [],
  nsfw: false,
  link: [],
  relations_from: [],
  content_limit: 0,
}

const texts = { locale: 'zh' as const, messages }

describe('gameHead', () => {
  it('names both titles and says what can be downloaded before the intro', () => {
    const head = gameHead(
      {
        header,
        details,
        resources: [
          { platform: ['win'], language: ['zh', 'jp'] },
          { platform: ['win'], language: ['zh'] },
        ],
      },
      texts,
    )
    expect(head.title).toBe('橘光柠水随想曲 / ライムライト・レモネードジャム')
    expect(head.description).toBe(
      '《橘光柠水随想曲》由 ゆずソフト 于 2025年9月26日 发售。本站提供 2 个资源，平台为 Windows，语言为简中和日文。音乐、伙伴，以及爱情。',
    )
    expect(head.image).toEqual({ path: '/game/962', alt: '橘光柠水随想曲' })
    const [game] = head.structured?.(path => `https://shionlib.com${path}`) ?? []
    expect(game).toMatchObject({
      '@type': 'VideoGame',
      name: '橘光柠水随想曲',
      alternateName: ['ライムライト・レモネードジャム', 'LLLJ'],
      url: 'https://shionlib.com/zh/game/962',
      gamePlatform: ['Windows'],
      author: [{ '@type': 'Organization', name: 'ゆずソフト' }],
      datePublished: '2025-09-26',
      image: 'https://images.example/cover.webp',
    })
  })

  it('names a tab after the game and leaves a blurred cover out of the structured data', () => {
    const blurred = {
      ...header,
      covers: header.covers?.map(cover => ({ ...cover, masked: true, sexual: 1 })) ?? null,
    }
    const head = gameHead({ header: blurred, details, resources: [] }, texts, 'characters')
    expect(head.title).toBe('橘光柠水随想曲 角色')
    expect(head.structured?.(path => path).map(data => data['@type'])).toEqual(['BreadcrumbList'])
    const main = gameHead({ header: blurred, details, resources: [] }, texts)
    expect(main.structured?.(path => path)[0]).not.toHaveProperty('image')
  })
})
