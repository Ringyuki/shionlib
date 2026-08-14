import { GameCharacterRole } from '@prisma/client'
import { OpenGalgameDetail } from '../interfaces/open-api.interface'
import {
  mapActor,
  mapCharacterRole,
  mapCoverKind,
  mapCoverLanguage,
  mapDeveloperRole,
  mapGalgameScalars,
  mapStaffs,
} from './galgame-sync.mapper'

function detail(overrides: Partial<OpenGalgameDetail> = {}): OpenGalgameDetail {
  return {
    id: 1,
    origin_title: '原題',
    trans_title: null,
    en_title: null,
    aliases: [],
    covers: [],
    images: [],
    release_date: null,
    release_date_tbd: false,
    release_date_tbd_note: '',
    origin_intro: null,
    trans_intro: null,
    en_intro: null,
    adv_type: null,
    platforms: [],
    homepage: null,
    engine: null,
    origin_lang: 'ja',
    dev_status: null,
    prices: [],
    external_links: [],
    nsfw: false,
    tags: [],
    created_at: '',
    updated_at: '',
    revised_at: null,
    ...overrides,
  }
}

describe('galgame sync mapper', () => {
  describe('mapGalgameScalars', () => {
    it('routes a japanese original title into the jp column', () => {
      const data = mapGalgameScalars(detail({ trans_title: '译名', en_title: 'English' }))
      expect(data.title_jp).toBe('原題')
      expect(data.title_zh).toBe('译名')
      expect(data.title_en).toBe('English')
    })

    it('routes a chinese original into the zh column and leaves jp empty', () => {
      const data = mapGalgameScalars(
        detail({ origin_lang: 'zh-Hans', origin_title: '中文原名', origin_intro: '中文简介' }),
      )
      expect(data.title_jp).toBe('')
      expect(data.title_zh).toBe('中文原名')
      expect(data.intro_zh).toBe('中文简介')
    })

    it('routes an english original into the en column', () => {
      const data = mapGalgameScalars(
        detail({ origin_lang: 'en', origin_title: 'Only English', origin_intro: 'Intro' }),
      )
      expect(data.title_en).toBe('Only English')
      expect(data.intro_en).toBe('Intro')
      expect(data.title_jp).toBe('')
    })

    it('prefers the dedicated translation over the origin fallback', () => {
      const data = mapGalgameScalars(
        detail({ origin_lang: 'zh-Hans', origin_title: '原名', trans_title: '正式译名' }),
      )
      expect(data.title_zh).toBe('正式译名')
    })
  })

  it('maps cover language onto the shionlib vocabulary', () => {
    expect(mapCoverLanguage('ja')).toBe('jp')
    expect(mapCoverLanguage('zh-Hant')).toBe('zh')
    expect(mapCoverLanguage('en')).toBe('en')
    expect(mapCoverLanguage(null)).toBe('unknown')
    expect(mapCoverLanguage('ko')).toBe('unknown')
  })

  it('defaults an unlabelled cover to the digital kind', () => {
    expect(mapCoverKind('PKGFRONT')).toBe('pkgfront')
    expect(mapCoverKind('DIG')).toBe('dig')
    expect(mapCoverKind(null)).toBe('dig')
  })

  it('keeps the four character roles distinct', () => {
    expect(mapCharacterRole('MAIN')).toBe(GameCharacterRole.main)
    expect(mapCharacterRole('PRIMARY')).toBe(GameCharacterRole.primary)
    expect(mapCharacterRole('SUPPORTING')).toBe(GameCharacterRole.side)
    expect(mapCharacterRole('GUEST')).toBe(GameCharacterRole.appears)
  })

  it('falls back to the developer role when a producer carries none', () => {
    expect(mapDeveloperRole('PUBLISHER')).toBe('发行')
    expect(mapDeveloperRole(null)).toBe('开发')
  })

  it('translates staff roles and joins voice actors the way shionlib stores them', () => {
    expect(mapStaffs([{ role: 'SCENARIO', person: ref('麻枝准') }])).toEqual([
      { name: '麻枝准', role: '剧本' },
    ])
    expect(mapStaffs([{ role: null, person: ref('无职') }])).toEqual([{ name: '无职', role: '' }])
    expect(
      mapActor({ role: 'MAIN', actors: [ref('声優A'), ref('声優B')], character: ref('角色') }),
    ).toBe('声優A, 声優B')
    expect(mapActor({ role: 'MAIN', actors: [], character: ref('角色') })).toBeNull()
  })
})

function ref(name: string) {
  return { id: 1, name, trans_name: null, image: null }
}
