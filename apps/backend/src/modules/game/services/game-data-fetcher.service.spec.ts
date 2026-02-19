jest.mock('../utils/language-detector.util', () => ({
  detectLanguage: jest.fn(),
}))

jest.mock('../utils/character-match.util', () => ({
  createCharacterMatcher: jest.fn(),
}))

jest.mock('../helpers/dedupe', () => ({
  dedupeCharactersInPlace: jest.fn(),
  dedupeDevelopersInPlace: jest.fn(),
}))

import { detectLanguage } from '../utils/language-detector.util'
import { createCharacterMatcher } from '../utils/character-match.util'
import { dedupeCharactersInPlace, dedupeDevelopersInPlace } from '../helpers/dedupe'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { GameDataFetcherService } from './game-data-fetcher.service'

describe('GameDataFetcherService', () => {
  const detectLanguageMock = detectLanguage as unknown as jest.Mock
  const createCharacterMatcherMock = createCharacterMatcher as unknown as jest.Mock
  const dedupeCharactersMock = dedupeCharactersInPlace as unknown as jest.Mock
  const dedupeDevelopersMock = dedupeDevelopersInPlace as unknown as jest.Mock

  const image = {
    small: '',
    grid: '',
    large: 'https://img/large',
    medium: '',
    common: '',
  }

  const createService = () => {
    const bangumiService = {
      bangumiRequest: jest.fn(),
    }
    const vndbService = {
      vndbRequest: jest.fn(),
    }
    const service = new GameDataFetcherService(bangumiService as any, vndbService as any)

    return {
      bangumiService,
      vndbService,
      service,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    detectLanguageMock.mockImplementation(async (text: string) => {
      const s = String(text || '')
      if (s.includes('EN')) return 'en'
      if (s.includes('ZH')) return 'zh'
      if (s.includes('JP')) return 'jp'
      return 'unknown'
    })
    createCharacterMatcherMock.mockImplementation((arr: any[]) => {
      return (target: any) => arr.find((c: any) => c.v_id === target.id)
    })
    dedupeCharactersMock.mockImplementation(() => {})
    dedupeDevelopersMock.mockImplementation(() => {})
  })

  it('fetchData rejects vndb id that already starts with v', async () => {
    const { service } = createService()

    await expect(service.fetchData('100', 'v123')).rejects.toMatchObject({
      code: ShionBizCode.GAME_INVALID_VNDB_ID,
    })
  })

  it('fetchData prefixes vndb id and delegates to bangumi fetcher', async () => {
    const { service } = createService()
    const spy = jest
      .spyOn(service as any, 'fetchDatafromBangumi')
      .mockResolvedValueOnce({ ok: true } as any)

    await expect(service.fetchData('100', '123')).resolves.toEqual({ ok: true })
    expect(spy).toHaveBeenCalledWith('100', 'v123', undefined)
  })

  it('fetchDatafromBangumi validates subject type and fails on non-game', async () => {
    const { service, bangumiService } = createService()
    bangumiService.bangumiRequest.mockImplementation(async (url: string) => {
      if (url.endsWith('/subjects/100')) {
        return { type: 3 }
      }
      return []
    })

    await expect(service.fetchData('100')).rejects.toMatchObject({
      code: ShionBizCode.GAME_BANGUMI_REQUEST_FAILED,
    })
  })

  it('fetchDatafromBangumi builds game/character/producer data without vndb path', async () => {
    const { service, bangumiService } = createService()

    const dataMap = new Map<string, any>([
      [
        'https://api.bgm.tv/v0/subjects/100',
        {
          id: 100,
          type: 4,
          date: '2024-01-01',
          platform: '',
          images: image,
          summary: 'ZH Game Summary',
          name: 'JP Game Name',
          name_cn: 'ZH Game Name CN',
          tags: [{ name: 'tag1' }, { name: 'tag2' }],
          infobox: [
            { key: '游戏类型', value: 'ADV' },
            { key: '制作人', value: 'EN Producer Name' },
          ],
          rating: {},
        },
      ],
      [
        'https://api.bgm.tv/v0/subjects/100/characters',
        [
          {
            id: 1,
            relation: '主角',
            name: '角色1',
            images: image,
            actors: [{ id: 501, name: 'actor1' }],
          },
          {
            id: 2,
            relation: '配角',
            name: '角色2',
            images: image,
            actors: [{ id: 502, name: 'actor2' }],
          },
        ],
      ],
      [
        'https://api.bgm.tv/v0/subjects/100/persons',
        [
          {
            id: 11,
            relation: '开发',
            name: 'DEV JP',
            images: image,
          },
          {
            id: 12,
            relation: '音乐',
            name: 'OTHER',
            images: image,
          },
        ],
      ],
      [
        'https://api.bgm.tv/v0/characters/1',
        {
          id: 1,
          gender: '',
          summary: 'JP Character Intro',
          name: '角色1',
          images: image,
          infobox: [
            { key: '简体中文名', value: 'ZH角色1' },
            { key: '别名', value: [{ k: '', v: 'Alias1' }] },
          ],
        },
      ],
      [
        'https://api.bgm.tv/v0/characters/2',
        {
          id: 2,
          gender: '',
          summary: 'ZH Character Intro',
          name: '角色2',
          images: image,
          infobox: [
            { key: '简体中文名', value: 'ZH角色2' },
            { key: '别名', value: 'Alias2' },
          ],
        },
      ],
      [
        'https://api.bgm.tv/v0/persons/11',
        {
          id: 11,
          name: 'DEV JP',
          summary: 'ZH Developer Intro',
          infobox: [
            { key: '别名', value: 'Dev Alias' },
            { key: '成立', value: '2000' },
          ],
        },
      ],
    ])
    bangumiService.bangumiRequest.mockImplementation(async (url: string) => {
      if (!dataMap.has(url)) throw new Error(`unexpected bangumi url: ${url}`)
      return dataMap.get(url)
    })

    const result = await service.fetchData('100')

    expect(result.finalGameData.b_id).toBe('100')
    expect(result.finalGameData.title_jp).toBe('JP Game Name')
    expect(result.finalGameData.title_zh).toBe('ZH Game Name CN')
    expect(result.finalGameData.intro_zh).toBe('ZH Game Summary')
    expect(result.finalGameData.tags).toEqual(['tag1', 'tag2'])
    expect(result.finalGameData.type).toBe('ADV')
    expect(result.finalCharactersData).toHaveLength(2)
    expect(result.finalCharactersData[0]).toEqual(
      expect.objectContaining({
        b_id: '1',
        actor: 'actor1',
        name_zh: 'ZH角色1',
        aliases: ['Alias1'],
      }),
    )
    expect(result.finalProducersData).toEqual([
      expect.objectContaining({
        b_id: '11',
        name: 'DEV JP',
        intro_zh: 'ZH Developer Intro',
        aliases: ['Dev Alias'],
      }),
    ])
    expect(dedupeCharactersMock).toHaveBeenCalled()
    expect(dedupeDevelopersMock).toHaveBeenCalled()
  })

  it('fetchRawFullCharactersDataFromBangumi batches requests in groups of 8', async () => {
    const { service, bangumiService } = createService()
    bangumiService.bangumiRequest.mockImplementation(async (url: string) => {
      const id = Number(url.split('/').pop())
      return { id, infobox: [], summary: '', name: '', images: image }
    })

    await expect((service as any).fetchRawFullCharactersDataFromBangumi([])).resolves.toEqual([])
    const result = await (service as any).fetchRawFullCharactersDataFromBangumi(
      Array.from({ length: 10 }, (_, i) => i + 1),
    )

    expect(result).toHaveLength(10)
    expect(bangumiService.bangumiRequest).toHaveBeenCalledTimes(10)
    expect(bangumiService.bangumiRequest).toHaveBeenCalledWith('https://api.bgm.tv/v0/characters/1')
    expect(bangumiService.bangumiRequest).toHaveBeenCalledWith(
      'https://api.bgm.tv/v0/characters/10',
    )
  })

  it('fetchRawFullProducersDataFromBangumi requests all ids', async () => {
    const { service, bangumiService } = createService()
    bangumiService.bangumiRequest.mockImplementation(async (url: string) => {
      const id = Number(url.split('/').pop())
      return { id, infobox: [], summary: '', name: '' }
    })

    const result = await (service as any).fetchRawFullProducersDataFromBangumi([7, 8])

    expect(result).toEqual([
      { id: 7, infobox: [], summary: '', name: '' },
      { id: 8, infobox: [], summary: '', name: '' },
    ])
    expect(bangumiService.bangumiRequest).toHaveBeenCalledWith('https://api.bgm.tv/v0/persons/7')
    expect(bangumiService.bangumiRequest).toHaveBeenCalledWith('https://api.bgm.tv/v0/persons/8')
  })

  it('fetchDataFromVNDB merges data, picks fallback cover, limits links and sets nsfw', async () => {
    const { service, vndbService } = createService()

    const existingCharacter = {
      b_id: '1',
      v_id: 'vc-exist',
      name_jp: 'old',
      aliases: ['old-alias'],
    }
    const existingDeveloper = {
      b_id: '11',
      name: 'Dev Ori',
      aliases: ['Legacy'],
    }
    createCharacterMatcherMock.mockReturnValue((target: any) =>
      target.id === 'vc-exist' ? existingCharacter : undefined,
    )

    vndbService.vndbRequest
      .mockResolvedValueOnce({
        id: 'v200',
        titles: [
          { lang: 'jp', title: 'JP VN', latin: 'JP VN', main: true },
          { lang: 'zh-Hans', title: 'ZH VN', latin: 'ZH VN', main: false },
          { lang: 'en', title: 'EN VN', latin: 'EN VN', main: false },
        ],
        aliases: ['AliasA'],
        released: '2024-10-01',
        description: 'EN VN Description',
        olang: 'zh',
        platforms: ['win'],
        screenshots: [{ url: 'https://ss/1', dims: [1, 2], sexual: 0, violence: 0 }],
        va: [
          {
            character: {
              id: 'vc-exist',
              name: 'EN Existing',
              original: 'JP Existing',
              aliases: ['NewAlias'],
              description: 'EN existing desc',
              blood_type: 'a',
              height: 160,
              weight: 50,
              bust: 80,
              waist: 60,
              hips: 85,
              cup: 'B',
              age: 18,
              birthday: [1, 1],
              gender: ['f'],
              image: { url: 'https://char/exist', dims: [1, 1], sexual: 0, violence: 0 },
              vns: [{ role: 'main', id: 'v200' }],
            },
          },
          {
            character: {
              id: 'vc-new',
              name: 'EN New',
              original: 'JP New Ori',
              aliases: ['Alias New'],
              description: 'EN new desc',
              blood_type: 'b',
              height: 170,
              weight: 60,
              bust: 0,
              waist: 0,
              hips: 0,
              cup: '',
              age: 20,
              birthday: [2, 2],
              gender: ['m', 'm'],
              image: { url: 'https://char/new', dims: [1, 1], sexual: 0, violence: 0 },
              vns: [{ role: 'side', id: 'v200' }],
            },
          },
        ],
        developers: [
          {
            id: 'dev-exist',
            name: 'Dev Name',
            original: 'Dev Ori',
            aliases: ['Legacy', 'NewA'],
            type: 'co',
            description: 'EN dev exist',
            extlinks: [{ label: 'Official website', name: '', url: 'https://dev.exist' }],
          },
          {
            id: 'dev-new',
            name: 'Dev New',
            original: 'Dev New Ori',
            aliases: ['N1'],
            type: 'co',
            description: 'EN dev new',
            extlinks: [{ label: 'Official website', name: '', url: 'https://dev.new' }],
          },
        ],
        extlinks: [
          { url: 'https://l1', label: 'a', name: '1' },
          { url: 'https://l2', label: 'a', name: '2' },
          { url: 'https://l3', label: 'a', name: '3' },
          { url: 'https://l4', label: 'a', name: '4' },
          { url: 'https://l5', label: 'a', name: '5' },
          { url: 'https://l6', label: 'a', name: '6' },
        ],
        image: { url: 'https://cover/fallback', dims: [100, 200], sexual: 2, violence: 2 },
      })
      .mockResolvedValueOnce([
        {
          id: 'r1',
          languages: [{ lang: 'ja', title: '', latin: '', mtl: '' }],
          platforms: [],
          images: [
            {
              type: 'pkgback',
              url: 'https://not-allowed',
              dims: [1, 1],
              sexual: 0,
              violence: 0,
              id: 'x',
              photo: '',
              languages: ['ja'],
            },
          ],
          extlinks: [{ url: 'https://release-link', label: 'r', name: 'r' }],
        },
      ])

    const result = await (service as any).fetchDataFromVNDB(
      'v200',
      { links: [] },
      [existingCharacter],
      [existingDeveloper],
      undefined,
      true,
    )

    expect(result.finalGameData.v_id).toBe('v200')
    expect(result.finalGameData.title_jp).toBe('JP VN')
    expect(result.finalGameData.title_zh).toBe('ZH VN')
    expect(result.finalGameData.title_en).toBe('EN VN')
    expect(result.finalGameData.intro_en).toBe('EN VN Description')
    expect(result.finalGameData.platform).toEqual(['win'])
    expect(result.finalGameData.links).toHaveLength(5)
    expect(result.finalCoversData).toEqual([
      {
        language: 'zh',
        type: 'dig',
        url: 'https://cover/fallback',
        dims: [100, 200],
        sexual: 2,
        violence: 2,
      },
    ])
    expect(result.finalGameData.nsfw).toBe(true)
    expect(result.finalCharactersData).toHaveLength(2)
    expect(result.finalCharactersData[0]).toEqual(
      expect.objectContaining({
        v_id: 'vc-exist',
        name_en: 'EN Existing',
        role: 'main',
        aliases: expect.arrayContaining(['old-alias', 'NewAlias']),
        gender: ['f', 'f'],
      }),
    )
    expect(result.finalCharactersData[1]).toEqual(
      expect.objectContaining({
        v_id: 'vc-new',
        name_en: 'EN New',
        name_jp: 'JP New Ori',
      }),
    )
    expect(result.finalProducersData).toHaveLength(2)
    expect(result.finalProducersData[0]).toEqual(
      expect.objectContaining({
        v_id: 'dev-exist',
        website: 'https://dev.exist',
        aliases: expect.arrayContaining(['Legacy', 'NewA']),
      }),
    )
    expect(result.finalProducersData[1]).toEqual(
      expect.objectContaining({
        v_id: 'dev-new',
        name: 'Dev New Ori',
      }),
    )
    expect(dedupeCharactersMock).toHaveBeenCalled()
    expect(dedupeDevelopersMock).toHaveBeenCalled()
  })

  it('consistencyCheck validates input and detects year/title consistency', () => {
    const { service } = createService()

    expect(() => (service as any).consistencyCheck(null, {})).toThrow()
    expect(() => (service as any).consistencyCheck({}, null)).toThrow()

    expect(() =>
      (service as any).consistencyCheck(
        {
          date: '2024-01-01',
          name: 'A',
          name_cn: '',
          infobox: [],
        },
        {
          released: '2025-05-01',
          titles: [],
          aliases: [],
        },
      ),
    ).not.toThrow()

    expect(() =>
      (service as any).consistencyCheck(
        {
          date: '2010-01-01',
          name: 'SameTitle',
          name_cn: '',
          infobox: [],
        },
        {
          released: '2024-01-01',
          titles: [{ title: 'sametitle', latin: '', lang: 'en' }],
          aliases: [],
        },
      ),
    ).not.toThrow()

    expect(() =>
      (service as any).consistencyCheck(
        {
          date: '2010-01-01',
          name: 'Title-A',
          name_cn: '',
          infobox: [],
        },
        {
          released: '2024-01-01',
          titles: [{ title: 'Title-B', latin: '', lang: 'en' }],
          aliases: ['Another'],
        },
      ),
    ).toThrow()
  })

  it('format/title/date helper methods normalize and compare values', () => {
    const { service } = createService()

    expect((service as any).formatString(' A \n\tB ')).toBe('ab')
    expect((service as any).formatString(undefined)).toBe('')
    expect((service as any).safeParseYear('release 2024-10-01')).toBe(2024)
    expect((service as any).safeParseYear('n/a')).toBeUndefined()
    expect((service as any).isReleaseYearClose('2024-01-01', '2025-01-01', 1)).toBe(true)
    expect((service as any).isReleaseYearClose('2024-01-01', '2030-01-01', 1)).toBe(false)
    expect((service as any).isTitleSimilar(['ABC'], ['abc'])).toBe(true)
    expect((service as any).isTitleSimilar(['ABC'], ['xyz'])).toBe(false)
    expect(
      (service as any).collectBangumiTitles({
        name: 'n1',
        name_cn: 'n2',
        infobox: [{ key: '别名', value: [{ k: '', v: 'a1' }] }],
      }),
    ).toEqual(expect.arrayContaining(['n1', 'n2', 'a1']))
    expect(
      (service as any).collectVNDBTitles({
        titles: [{ title: 't1', latin: 'l1' }],
        aliases: ['a2'],
      }),
    ).toEqual(expect.arrayContaining(['t1', 'l1', 'a2']))
  })
})
