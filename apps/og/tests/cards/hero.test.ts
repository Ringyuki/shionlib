import { describe, expect, it } from 'bun:test'
import {
  characterHero,
  docsHero,
  gameHero,
  resourceHero,
  walkthroughHero,
} from '../../src/cards/hero'
import type { GameHeader, Resource } from '../../src/services/catalog'

const game: GameHeader = {
  id: 962,
  title_zh: '橘光柠水随想曲',
  title_jp: 'ライムライト・レモネードジャム',
  title_en: '',
  covers: [
    {
      type: 'dig',
      url: 'https://images.example/962.webp',
      dims: [500, 709],
      sexual: 0,
      violence: 0,
      masked: false,
    },
  ],
  developers: [{ developer: { id: 5135, name: 'ゆずソフト' } }],
  release_date: '2025-09-26T00:00:00.000Z',
}

const resource = (overrides: Partial<Resource>): Resource => ({
  platform: ['win'],
  language: ['zh'],
  translators: [],
  form: 'portable',
  downloads: 0,
  files: [],
  ...overrides,
})

describe('gameHero', () => {
  it('describes the game by its developer, release day and what can be downloaded', () => {
    const view = gameHero(game, [resource({}), resource({ language: ['jp'] })], 'zh')
    expect(view).toMatchObject({
      title: '橘光柠水随想曲',
      subtitle: 'ライムライト・レモネードジャム',
      meta: 'ゆずソフト · 2025年9月26日',
      note: '2 个资源',
      picture: { src: 'https://images.example/962.webp', masked: false, shape: 'cover' },
    })
    expect(view.tags.map(tag => tag.label)).toEqual(['Windows', '简中', '日文'])
  })

  it('says nothing about resources when there are none', () => {
    const view = gameHero({ ...game, covers: [], release_date: null }, [], 'en')
    expect(view.note).toBeUndefined()
    expect(view.picture).toBeUndefined()
    expect(view.meta).toBe('ゆずソフト')
    expect(view.tags).toEqual([])
  })
})

describe('resourceHero', () => {
  it('names the translators and gives the size and downloads', () => {
    const view = resourceHero(
      {
        game,
        resource: resource({
          translators: [{ name: 'Can/need' }, { name: '破琵琶生产公社汉化组' }],
          downloads: 1886,
          files: [{ file_size: 9205871997 }],
        }),
      },
      'zh',
    )
    expect(view.subtitle).toBe('Can/need、破琵琶生产公社汉化组')
    expect(view.facts).toEqual([
      { icon: 'size', text: '8.57 GB' },
      { icon: 'downloads', text: '1,886 次下载' },
    ])
    expect(view.tags.map(tag => tag.label)).toEqual(['Windows', '简中', '免安装'])
  })
})

describe('walkthroughHero', () => {
  const walkthrough = (names: string[]) => ({
    game_id: 365,
    lang: 'jp',
    updated: '2018-06-14T04:00:00.000Z',
    creator: { name: 'seiya-saiga' },
    routes: names.map(name => ({ name })),
  })

  it('shows the first routes and how many there are in all', () => {
    const names = ['相楽美佐枝', '一ノ瀬ことみ', '伊吹風子', '春原兄妹', '', '宮沢有紀寧']
    const view = walkthroughHero(walkthrough(names), game, 'zh')
    expect(view.badge).toEqual({ label: '攻略', icon: 'map' })
    expect(view.meta).toBe('seiya-saiga · 日语 · 更新于 2018年6月14日')
    expect(view.tags.map(tag => tag.label)).toEqual(['相楽美佐枝', '一ノ瀬ことみ', '伊吹風子'])
    expect(view.note).toBe('等 5 条线路')
  })

  it('needs no count when every route is shown', () => {
    expect(walkthroughHero(walkthrough(['A', 'B']), game, 'zh').note).toBeUndefined()
  })
})

describe('characterHero', () => {
  it('places the character in its first game with its voice', () => {
    const view = characterHero(
      {
        name_jp: 'ムラサメ',
        name_zh: '丛雨',
        name_en: 'Murasame',
        image: 'character/1/image/a.webp',
        gender: ['f'],
        age: 500,
        appearances: [{ game_id: 708, role: 'main', actor: '山本希望' }],
      },
      { ...game, title_zh: '千恋＊万花', title_jp: '千恋＊万花' },
      'zh',
    )
    expect(view).toMatchObject({
      title: '丛雨',
      subtitle: 'ムラサメ',
      meta: '千恋＊万花 · CV 山本希望',
      picture: { src: 'https://t.shionlib.com/character/1/image/a.webp', shape: 'portrait' },
    })
    expect(view.tags.map(tag => tag.label)).toEqual(['主角', '女', '500 岁'])
  })
})

describe('docsHero', () => {
  it('labels the document with its category and signs it', () => {
    const view = docsHero(
      {
        title: '开放接口',
        category: 'dev',
        authorName: 'ringyuki',
        date: '2026-10-14',
        banner: 'https://images.example/banner.webp',
      },
      'zh',
    )
    expect(view.badge).toEqual({ label: '文档 · 开发' })
    expect(view.byline).toEqual({ name: 'ringyuki', avatar: undefined, date: '2026年10月14日' })
    expect(view.picture?.shape).toBe('banner')
  })
})
