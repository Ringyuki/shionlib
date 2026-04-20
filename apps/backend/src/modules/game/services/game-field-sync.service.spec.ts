jest.mock('../../search/helpers/format-doc', () => ({
  formatDoc: jest.fn(() => ({ id: 1, indexed: true })),
  rawDataQuery: { id: true },
}))

import { formatDoc } from '../../search/helpers/format-doc'
import { GameRelationType } from '@prisma/client'
import { GameCharacterRole, GameScalarSyncFieldEnum } from '../dto/req/edit-game.req.dto'
import { GameEntityUpsertService } from './game-entity-upsert.service'
import { GameFieldSyncService } from './game-field-sync.service'

describe('GameFieldSyncService', () => {
  const formatDocMock = formatDoc as unknown as jest.Mock
  const req = { user: { sub: 7, role: 2 } }
  const emptySnapshot = {
    finalGameData: {},
    finalCharactersData: [],
    finalProducersData: [],
    finalCoversData: [],
  }
  const scalarGame = {
    id: 1,
    b_id: '100',
    v_id: 'v1',
    title_jp: 'Local JP',
    title_zh: '',
    title_en: null,
    aliases: [],
    intro_jp: '',
    intro_zh: '',
    intro_en: '',
    release_date: null,
    release_date_tba: true,
    type: null,
    platform: [],
    extra_info: [],
    staffs: [],
    tags: [
      { tag_alias: 'AVG', tag: { name: 'avg' } },
      { tag_alias: null, tag: { name: 'old' } },
    ],
  }

  const createService = () => {
    const prisma = {
      game: {
        findUnique: jest.fn().mockResolvedValue(scalarGame),
        findMany: jest.fn(),
      },
      gameLink: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gameCover: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gameImage: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gameRelation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gameDeveloperRelation: {
        findMany: jest.fn(),
      },
      gameDeveloper: {
        findMany: jest.fn(),
      },
      gameCharacterRelation: {
        findMany: jest.fn(),
      },
      gameCharacter: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const tx = {
      game: {
        findUnique: jest.fn().mockResolvedValue({ id: 1 }),
      },
      gameDeveloperRelation: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
      },
      gameDeveloper: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      gameCharacterRelation: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
      },
      gameCharacter: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      editRecord: {
        create: jest.fn().mockResolvedValue({ id: 900 }),
      },
    }

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    const bangumiAuthService = { bangumiRequest: jest.fn() }
    const vndbService = { vndbRequest: jest.fn() }
    const gameDataFetcherService = { fetchData: jest.fn().mockResolvedValue(emptySnapshot) }
    const gameEditService = {
      addLinks: jest.fn(),
      editLinks: jest.fn(),
      addCovers: jest.fn(),
      editCovers: jest.fn(),
      addImages: jest.fn(),
      editImages: jest.fn(),
      addDevelopers: jest.fn(),
      addCharacters: jest.fn(),
      editDevelopers: jest.fn(),
      editCharacters: jest.fn(),
      addGameRelations: jest.fn(),
      editGameRelations: jest.fn(),
      editGameScalar: jest.fn(),
    }
    const gameTagService = {
      normalizeTag: jest.fn((raw: string) => raw.toLowerCase().trim().replace(/\s+/g, ' ')),
      normalizeDisplayTag: jest.fn((raw: string) => raw.trim().replace(/\s+/g, ' ')),
    }
    const activityService = { create: jest.fn() }
    const searchEngine = { upsertGame: jest.fn() }

    const service = new GameFieldSyncService(
      prisma as any,
      bangumiAuthService as any,
      vndbService as any,
      gameDataFetcherService as any,
      gameEditService as any,
      new GameEntityUpsertService(),
      gameTagService as any,
      activityService as any,
      searchEngine as any,
    )

    return {
      prisma,
      tx,
      bangumiAuthService,
      vndbService,
      gameDataFetcherService,
      gameEditService,
      activityService,
      searchEngine,
      service,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    formatDocMock.mockReturnValue({ id: 1, indexed: true })
  })

  it('builds scalar candidates for each scalar field and applies the selected field', async () => {
    const { service, gameDataFetcherService, gameEditService } = createService()
    const releaseDate = new Date('2026-01-02T00:00:00.000Z')
    gameDataFetcherService.fetchData.mockResolvedValue({
      ...emptySnapshot,
      finalGameData: {
        title_jp: 'Remote JP',
        title_zh: '远程标题',
        title_en: 'Remote EN',
        aliases: ['Alias'],
        intro_jp: 'JP intro',
        intro_zh: 'ZH intro',
        intro_en: 'EN intro',
        release_date: releaseDate,
        type: 'ADV',
        platform: ['win'],
        extra_info: [{ key: 'engine', value: 'kirikiri' }],
        staffs: [{ name: 'Writer', role: 'scenario' }],
        tags: ['AVG', 'avg', ' R18 '],
      },
    })

    const fields = [
      GameScalarSyncFieldEnum.TITLES,
      GameScalarSyncFieldEnum.ALIASES,
      GameScalarSyncFieldEnum.INTROS,
      GameScalarSyncFieldEnum.RELEASE,
      GameScalarSyncFieldEnum.TYPE,
      GameScalarSyncFieldEnum.PLATFORMS,
      GameScalarSyncFieldEnum.EXTRA,
      GameScalarSyncFieldEnum.STAFFS,
      GameScalarSyncFieldEnum.TAGS,
    ]

    const previews = await Promise.all(fields.map(field => service.previewScalar(1, field)))

    expect(previews.every(preview => preview.summary.total === 1)).toBe(true)
    expect(previews[0].candidates[0].remote).toMatchObject({
      title_jp: 'Remote JP',
      title_zh: '远程标题',
      title_en: 'Remote EN',
    })
    expect(previews[3].candidates[0].remote).toEqual({
      release_date: releaseDate.toISOString(),
      release_date_tba: false,
    })
    expect(previews[8].candidates[0].remote).toEqual({ tags: ['AVG', 'R18'] })
    expect(previews[8].candidates[0]).not.toHaveProperty('apply')

    const result = await service.applyScalar(
      1,
      GameScalarSyncFieldEnum.TITLES,
      [previews[0].candidates[0].id],
      req as any,
      'sync title',
    )

    expect(result).toEqual({ applied: 1 })
    expect(gameEditService.editGameScalar).toHaveBeenCalledWith(
      1,
      {
        title_jp: 'Remote JP',
        title_zh: '远程标题',
        title_en: 'Remote EN',
        note: 'sync title',
      },
      req,
    )
  })

  it('skips scalar candidates when remote data is empty, unchanged, or invalid', async () => {
    const { service, gameDataFetcherService } = createService()
    gameDataFetcherService.fetchData.mockResolvedValue({
      ...emptySnapshot,
      finalGameData: {
        aliases: [],
        platform: [],
        release_date: new Date('invalid'),
        title_jp: scalarGame.title_jp,
      },
    })

    await expect(service.previewScalar(1, GameScalarSyncFieldEnum.ALIASES)).resolves.toMatchObject({
      summary: { total: 0 },
    })
    await expect(
      service.previewScalar(1, GameScalarSyncFieldEnum.PLATFORMS),
    ).resolves.toMatchObject({ summary: { total: 0 } })
    await expect(service.previewScalar(1, GameScalarSyncFieldEnum.RELEASE)).resolves.toMatchObject({
      summary: { total: 0 },
    })
    await expect(service.previewScalar(1, GameScalarSyncFieldEnum.TITLES)).resolves.toMatchObject({
      summary: { total: 0 },
    })
    await expect(
      service.applyScalar(1, GameScalarSyncFieldEnum.TITLES, [], req as any),
    ).resolves.toEqual({ applied: 0 })
  })

  it('previews and applies link additions and updates', async () => {
    const { service, prisma, gameDataFetcherService, gameEditService } = createService()
    gameDataFetcherService.fetchData.mockResolvedValue({
      ...emptySnapshot,
      finalGameData: {
        links: [
          { url: 'HTTPS://EXAMPLE.COM/path/#hash', label: 'official', name: 'Official' },
          { url: 'https://new.test/', label: 'download', name: 'Download' },
          { url: 'https://new.test', label: 'duplicate', name: 'Duplicate' },
        ],
      },
    })
    prisma.gameLink.findMany.mockResolvedValue([
      { id: 5, url: 'https://example.com/path', label: 'old', name: 'Official' },
    ])

    const preview = await service.preview(1, 'links')
    await service.apply(
      1,
      'links',
      preview.candidates.map(c => c.id),
      req as any,
    )

    expect(preview.summary).toMatchObject({ total: 2, add: 1, update: 1, defaultSelected: 1 })
    expect(gameEditService.addLinks).toHaveBeenCalledWith(
      1,
      [{ url: 'https://new.test/', label: 'download', name: 'Download' }],
      req,
    )
    expect(gameEditService.editLinks).toHaveBeenCalledWith(
      1,
      [{ id: 5, url: 'HTTPS://EXAMPLE.COM/path/#hash', label: 'official', name: 'Official' }],
      req,
    )
  })

  it('previews and applies cover and image additions and updates', async () => {
    const { service, prisma, gameDataFetcherService, gameEditService } = createService()
    gameDataFetcherService.fetchData.mockResolvedValue({
      ...emptySnapshot,
      finalGameData: {
        images: [
          {
            url: 'https://img.test/old',
            dims: [800, 600],
            sexual: 1,
            violence: 0,
            source: 'vndb',
            source_key: 'image-old',
            source_url: 'https://img.test/old',
          },
          {
            url: 'https://img.test/new',
            dims: [0, 0],
            sexual: 0,
            violence: 0,
          },
        ],
      },
      finalCoversData: [
        {
          language: 'zh-Hans',
          type: 'dig',
          url: 'https://cover.test/old',
          dims: [1200, 1600],
          sexual: 1,
          violence: 0,
          source: 'vndb',
          source_key: 'cover-old',
          source_url: 'https://cover.test/old',
        },
        {
          language: 'en',
          type: 'pkgfront',
          url: 'https://cover.test/new',
          dims: [600, 800],
          sexual: 0,
          violence: 0,
          source: 'vndb',
          source_key: 'cover-new',
          source_url: 'https://cover.test/new',
        },
      ],
    })
    prisma.gameCover.findMany.mockResolvedValue([
      {
        id: 11,
        language: 'jp',
        type: 'dig',
        url: 'https://cover.test/old',
        dims: [],
        sexual: 0,
        violence: 0,
        source: 'vndb',
        source_key: 'cover-old',
        source_url: 'https://cover.test/old',
      },
    ])
    prisma.gameImage.findMany.mockResolvedValue([
      {
        id: 12,
        url: 'https://img.test/old',
        dims: [],
        sexual: 0,
        violence: 0,
        source: null,
        source_key: null,
        source_url: null,
      },
    ])

    const coverPreview = await service.preview(1, 'covers')
    const imagePreview = await service.preview(1, 'images')
    await service.apply(
      1,
      'covers',
      coverPreview.candidates.map(c => c.id),
      req as any,
    )
    await service.apply(
      1,
      'images',
      imagePreview.candidates.map(c => c.id),
      req as any,
    )

    expect(coverPreview.summary).toMatchObject({ total: 2, add: 1, update: 1 })
    expect(coverPreview.candidates[0].remote).toMatchObject({ language: 'zh' })
    expect(imagePreview.summary).toMatchObject({ total: 2, add: 1, update: 1 })
    expect(imagePreview.candidates.find(c => c.action === 'add')).toMatchObject({
      defaultSelected: false,
      warnings: [
        'Existing images do not have source metadata; confirm manually to avoid duplicates.',
      ],
    })
    expect(gameEditService.addCovers).toHaveBeenCalledWith(
      1,
      [expect.objectContaining({ source_key: 'cover-new' })],
      req,
    )
    expect(gameEditService.editCovers).toHaveBeenCalledWith(
      1,
      [expect.objectContaining({ id: 11, language: 'zh' })],
      req,
    )
    expect(gameEditService.addImages).toHaveBeenCalledWith(
      1,
      [expect.objectContaining({ url: 'https://img.test/new' })],
      req,
    )
    expect(gameEditService.editImages).toHaveBeenCalledWith(
      1,
      [expect.objectContaining({ id: 12, source_key: 'image-old' })],
      req,
    )
  })

  it('builds developer role update candidates when local role differs', async () => {
    const { service, prisma, gameDataFetcherService } = createService()
    gameDataFetcherService.fetchData.mockResolvedValue({
      finalGameData: {},
      finalCharactersData: [],
      finalProducersData: [{ b_id: '200', name: 'Studio' }],
      finalCoversData: [],
    })
    prisma.gameDeveloperRelation.findMany.mockResolvedValue([
      {
        id: 10,
        developer_id: 20,
        role: '发行',
        developer: { id: 20, b_id: '200', v_id: null, name: 'Studio', aliases: [] },
      },
    ])
    prisma.gameDeveloper.findMany.mockResolvedValue([
      { id: 20, b_id: '200', v_id: null, name: 'Studio', aliases: [] },
    ])

    const preview = await service.preview(1, 'developers')

    expect(preview.candidates).toHaveLength(1)
    expect(preview.candidates[0]).toMatchObject({
      action: 'update',
      defaultSelected: false,
      local: { role: '发行' },
      remote: { role: '开发' },
    })
  })

  it('creates developer entity and relation in the same transaction', async () => {
    const {
      service,
      prisma,
      tx,
      gameDataFetcherService,
      gameEditService,
      activityService,
      searchEngine,
    } = createService()
    gameDataFetcherService.fetchData.mockResolvedValue({
      finalGameData: {},
      finalCharactersData: [],
      finalProducersData: [{ v_id: 'p1', name: 'Studio' }],
      finalCoversData: [],
    })
    prisma.gameDeveloperRelation.findMany.mockResolvedValue([])
    prisma.gameDeveloper.findMany.mockResolvedValue([])
    tx.gameDeveloper.findFirst.mockResolvedValue(null)
    tx.gameDeveloper.create.mockResolvedValue({ id: 21, name: 'Studio' })
    tx.gameDeveloper.findMany.mockResolvedValue([{ id: 21, name: 'Studio' }])

    const preview = await service.preview(1, 'developers')
    await service.apply(1, 'developers', [preview.candidates[0].id], req as any)

    expect(tx.gameDeveloper.create).toHaveBeenCalled()
    expect(tx.gameDeveloperRelation.createMany).toHaveBeenCalledWith({
      data: [{ game_id: 1, developer_id: 21, role: '开发' }],
    })
    expect(tx.editRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADD_RELATION',
          relation_type: 'developer',
          field_changes: ['developers'],
        }),
      }),
    )
    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GAME_EDIT', game_id: 1, edit_record_id: 900 }),
      tx,
    )
    expect(gameEditService.addDevelopers).not.toHaveBeenCalled()
    expect(searchEngine.upsertGame).toHaveBeenCalledWith({ id: 1, indexed: true })
  })

  it('creates character entity and relation in the same transaction', async () => {
    const {
      service,
      prisma,
      tx,
      gameDataFetcherService,
      gameEditService,
      activityService,
      searchEngine,
    } = createService()
    gameDataFetcherService.fetchData.mockResolvedValue({
      finalGameData: {},
      finalCharactersData: [
        { v_id: 'c1', name_jp: 'Hero', role: GameCharacterRole.MAIN, actor: 'VA' },
      ],
      finalProducersData: [],
      finalCoversData: [],
    })
    prisma.gameCharacterRelation.findMany.mockResolvedValue([])
    prisma.gameCharacter.findMany.mockResolvedValue([])
    tx.gameCharacter.findFirst.mockResolvedValue(null)
    tx.gameCharacter.create.mockResolvedValue({ id: 31, name_jp: 'Hero' })
    tx.gameCharacter.findMany.mockResolvedValue([
      { id: 31, name_jp: 'Hero', name_zh: null, name_en: null },
    ])

    const preview = await service.preview(1, 'characters')
    await service.apply(1, 'characters', [preview.candidates[0].id], req as any)

    expect(tx.gameCharacter.create).toHaveBeenCalled()
    expect(tx.gameCharacterRelation.createMany).toHaveBeenCalledWith({
      data: [{ game_id: 1, character_id: 31, role: GameCharacterRole.MAIN, actor: 'VA' }],
    })
    expect(tx.editRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADD_RELATION',
          relation_type: 'character',
          field_changes: ['characters'],
        }),
      }),
    )
    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GAME_EDIT', game_id: 1, edit_record_id: 900 }),
      tx,
    )
    expect(gameEditService.addCharacters).not.toHaveBeenCalled()
    expect(searchEngine.upsertGame).toHaveBeenCalledWith({ id: 1, indexed: true })
  })

  it('previews and applies Bangumi relation adds and updates while keeping unmatched items read-only', async () => {
    const { service, prisma, bangumiAuthService, gameEditService } = createService()
    bangumiAuthService.bangumiRequest.mockResolvedValue([
      { id: 200, relation: '续集', name: 'Sequel', name_cn: '' },
      { id: 201, relation: '前传', name: 'Prequel', name_cn: '前传名' },
      { id: 202, relation: '主线故事', name: 'Missing local' },
      { id: 999, relation: '无关', name: 'Ignored' },
    ])
    prisma.game.findMany.mockResolvedValue([
      { id: 2, b_id: '200', title_jp: 'Sequel JP', title_zh: '', title_en: '' },
      { id: 3, b_id: '201', title_jp: 'Prequel JP', title_zh: '', title_en: '' },
    ])
    prisma.gameRelation.findMany.mockResolvedValue([
      { id: 30, to_game_id: 3, relation: GameRelationType.SEQUEL },
    ])

    const preview = await service.preview(1, 'relations')
    await service.apply(
      1,
      'relations',
      preview.candidates.map(c => c.id),
      req as any,
    )

    expect(preview.summary).toMatchObject({ total: 3, add: 1, update: 1, unmatched: 1 })
    expect(preview.candidates.find(c => c.action === 'unmatched')).toMatchObject({
      applicable: false,
      defaultSelected: false,
    })
    expect(gameEditService.addGameRelations).toHaveBeenCalledWith(
      1,
      [{ to_game_id: 2, relation: GameRelationType.SEQUEL }],
      req,
    )
    expect(gameEditService.editGameRelations).toHaveBeenCalledWith(
      1,
      [{ id: 30, relation: GameRelationType.PREQUEL }],
      req,
    )
  })

  it('builds character update candidates and applies relation edits', async () => {
    const { service, prisma, gameDataFetcherService, gameEditService } = createService()
    gameDataFetcherService.fetchData.mockResolvedValue({
      ...emptySnapshot,
      finalCharactersData: [
        {
          b_id: 'char-1',
          name_jp: 'Hero',
          name_zh: '主角',
          role: GameCharacterRole.PRIMARY,
          actor: 'Remote VA',
        },
        {
          name_jp: 'Cameo',
          role: GameCharacterRole.APPEARS,
        },
      ],
    })
    prisma.gameCharacterRelation.findMany.mockResolvedValue([
      {
        id: 41,
        character_id: 51,
        role: null,
        actor: null,
        character: {
          id: 51,
          b_id: 'char-1',
          v_id: null,
          name_jp: 'Hero',
          name_zh: '',
          name_en: '',
          aliases: [],
        },
      },
    ])
    prisma.gameCharacter.findMany.mockResolvedValue([
      {
        id: 51,
        b_id: 'char-1',
        v_id: null,
        name_jp: 'Hero',
        name_zh: '',
        name_en: '',
        aliases: [],
      },
      {
        id: 52,
        b_id: null,
        v_id: null,
        name_jp: 'Cameo',
        name_zh: '',
        name_en: '',
        aliases: ['Guest'],
      },
    ])

    const preview = await service.preview(1, 'characters')
    const update = preview.candidates.find(c => c.action === 'update')!
    const add = preview.candidates.find(c => c.action === 'add')!
    await service.apply(1, 'characters', [update.id], req as any)

    expect(update).toMatchObject({
      defaultSelected: true,
      local: { role: null, actor: null },
      remote: { role: GameCharacterRole.PRIMARY, actor: 'Remote VA' },
    })
    expect(add).toMatchObject({
      defaultSelected: false,
      confidence: 'medium',
      warnings: ['Matched by name or alias.'],
    })
    expect(gameEditService.editCharacters).toHaveBeenCalledWith(
      1,
      [
        {
          id: 41,
          character_id: 51,
          role: GameCharacterRole.PRIMARY,
          actor: 'Remote VA',
        },
      ],
      req,
    )
  })

  it('uses VNDB-only snapshots when only a VNDB id is available', async () => {
    const { service, prisma, vndbService } = createService()
    prisma.game.findUnique.mockResolvedValue({ id: 1, b_id: null, v_id: '42' })
    vndbService.vndbRequest.mockImplementation(
      async (_mode: string, _filter: unknown, _fields: string[], type: string) => {
        if (type === 'vn') {
          return {
            id: 'v42',
            titles: [
              { lang: 'jp', title: '日本語' },
              { lang: 'zh-Hans', title: '中文' },
              { lang: 'en', title: 'English' },
            ],
            aliases: ['Alias'],
            released: '2025-05-01',
            description: 'VNDB intro',
            platforms: ['win'],
            screenshots: [
              { url: 'https://shot.test/1', dims: [1280, 720], sexual: 0, violence: 0 },
            ],
            va: [
              {
                character: {
                  id: 'c1',
                  aliases: ['Heroine'],
                  description: 'Character intro',
                  name: 'Hero',
                  original: 'ヒロイン',
                  blood_type: 'A',
                  height: 160,
                  weight: 45,
                  bust: 80,
                  waist: 55,
                  hips: 82,
                  cup: 'C',
                  age: 18,
                  birthday: [1, 2],
                  gender: ['female'],
                  image: { url: 'https://char.test/1', sexual: 0, violence: 0 },
                  vns: [{ id: 'v42', role: GameCharacterRole.MAIN }],
                },
              },
            ],
            developers: [
              {
                id: 'p1',
                name: 'Studio',
                original: '',
                aliases: ['Circle'],
                description: 'Dev intro',
                extlinks: [{ label: 'Official website', url: 'https://studio.test' }],
              },
            ],
            extlinks: [{ url: 'https://game.test', label: 'official', name: 'Official' }],
          }
        }

        return [
          {
            extlinks: [{ url: 'https://release.test', label: 'release', name: 'Release' }],
            languages: [{ lang: 'zh-Hans' }],
            images: [
              {
                type: 'dig',
                id: 'cover-1',
                url: 'https://cover.test/1',
                dims: [600, 800],
                sexual: 2,
                violence: 0,
              },
              {
                type: 'back',
                id: 'ignored',
                url: 'https://cover.test/back',
                dims: [600, 800],
                sexual: 0,
                violence: 0,
              },
            ],
          },
        ]
      },
    )

    const linkPreview = await service.preview(1, 'links')
    const coverPreview = await service.preview(1, 'covers')

    expect(linkPreview.summary).toMatchObject({ total: 2, add: 2 })
    expect(coverPreview.candidates[0]).toMatchObject({
      title: 'zh / dig',
      remote: expect.objectContaining({
        source: 'vndb',
        source_key: 'cover-1',
        source_url: 'https://cover.test/1',
      }),
    })
    expect(vndbService.vndbRequest).toHaveBeenCalledWith(
      'single',
      ['id', '=', 'v42'],
      expect.any(Array),
      'vn',
    )
  })

  it('falls back to VNDB after Bangumi snapshot failure and throws when no fallback id exists', async () => {
    const { service, prisma, gameDataFetcherService, vndbService } = createService()
    gameDataFetcherService.fetchData.mockRejectedValue(new Error('bangumi down'))
    vndbService.vndbRequest.mockImplementation(async (_mode, _filter, _fields, type) =>
      type === 'vn' ? { id: 'v1', extlinks: [] } : [],
    )

    await expect(service.preview(1, 'links')).resolves.toMatchObject({ summary: { total: 0 } })

    prisma.game.findUnique.mockResolvedValue({ id: 1, b_id: '100', v_id: null })
    await expect(service.preview(1, 'links')).rejects.toThrow('bangumi down')
  })

  it('returns empty previews for games without external ids and rejects missing games', async () => {
    const { service, prisma } = createService()
    prisma.game.findUnique.mockResolvedValue({ id: 1, b_id: null, v_id: null })

    await expect(service.preview(1, 'links')).resolves.toMatchObject({ summary: { total: 0 } })

    prisma.game.findUnique.mockResolvedValue(null)
    await expect(service.preview(1, 'links')).rejects.toBeTruthy()
    await expect(service.previewScalar(1, GameScalarSyncFieldEnum.TITLES)).rejects.toBeTruthy()
  })

  it('covers helper edge cases used by candidate matching', () => {
    const { service } = createService()
    const subject = service as any

    expect(subject.normalizeUrl()).toBe('')
    expect(subject.normalizeUrl('HTTPS://Example.COM/path/#hash')).toBe('https://example.com/path')
    expect(subject.normalizeUrl('not a url/')).toBe('not a url')
    expect(subject.normalizeCoverLanguage()).toBe('other')
    expect(subject.normalizeCoverLanguage('zh-Hans')).toBe('zh')
    expect(subject.normalizeCoverLanguage('ja')).toBe('jp')
    expect(subject.normalizeCoverLanguage('en')).toBe('en')
    expect(subject.normalizeCoverLanguage('ko')).toBe('other')
    expect(subject.stripVndbPrefix('v123')).toBe('123')
    expect(subject.ensureVndbPrefix('123')).toBe('v123')
    expect(subject.ensureVndbPrefix('v123')).toBe('v123')
    expect(
      subject.sameMedia(
        { url: 'x', source: 'vndb', source_key: 'a' },
        {
          url: 'y',
          source: 'vndb',
          source_key: 'a',
        },
      ),
    ).toBe(true)
    expect(
      subject.sameMedia({ url: 'x', source_url: 'remote' }, { url: 'y', source_url: 'remote' }),
    ).toBe(true)
    expect(subject.sameMedia({ url: 'https://a.test/#hash' }, { url: 'https://a.test/' })).toBe(
      true,
    )
    expect(
      subject.mediaFieldsChanged(
        { dims: [], sexual: 0, violence: 0 },
        {
          dims: [],
          sexual: 0,
          violence: 0,
        },
      ),
    ).toBeFalsy()
    expect(
      subject.mediaFieldsChanged(
        { dims: [], sexual: 0, violence: 0 },
        {
          dims: [1, 2],
          sexual: 0,
          violence: 0,
        },
      ),
    ).toBe(true)
    expect(subject.formatDims([1, 2])).toBe('1x2')
    expect(subject.formatDims([1])).toBe('')
    expect(subject.isEmptyDims([])).toBe(true)
    expect(subject.isEmptyDims([0, 0])).toBe(true)
    expect(subject.isEmptyDims([1, 0])).toBe(false)
    expect(subject.isEmptyValue(undefined)).toBe(true)
    expect(subject.isEmptyValue(null)).toBe(true)
    expect(subject.isEmptyValue('')).toBe(true)
    expect(subject.isEmptyValue([])).toBe(true)
    expect(subject.isEmptyValue(['x'])).toBe(false)
    expect(subject.stableEqual({ b: 1, a: [2] }, { a: [2], b: 1 })).toBe(true)
    expect(subject.externalEntityKey({ b_id: 'b1', v_id: 'v1' })).toBe('bangumi:b1')
    expect(subject.externalEntityKey({ v_id: 'v1' })).toBe('vndb:v1')
    expect(subject.externalEntityKey({ name: ' Name ' })).toBe('name:name')
    expect(subject.isImportantCharacterRole(GameCharacterRole.MAIN)).toBe(true)
    expect(subject.isImportantCharacterRole(GameCharacterRole.PRIMARY)).toBe(true)
    expect(subject.isImportantCharacterRole(GameCharacterRole.APPEARS)).toBe(false)
  })
})
