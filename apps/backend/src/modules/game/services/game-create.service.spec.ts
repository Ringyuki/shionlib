jest.mock('../../search/helpers/format-doc', () => ({
  formatDoc: jest.fn(() => ({ id: 1, indexed: true })),
  rawDataQuery: { id: true },
}))

import { formatDoc } from '../../search/helpers/format-doc'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { GameCreateService } from './game-create.service'

describe('GameCreateService', () => {
  const formatDocMock = formatDoc as unknown as jest.Mock

  const createService = () => {
    const prisma = {
      game: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const tx = {
      game: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      gameCover: {
        createMany: jest.fn(),
      },
      gameImage: {
        createMany: jest.fn(),
      },
      gameLink: {
        createMany: jest.fn(),
      },
      gameDeveloper: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      gameDeveloperRelation: {
        create: jest.fn().mockResolvedValue({}),
      },
      gameCharacter: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      gameCharacterRelation: {
        create: jest.fn().mockResolvedValue({}),
      },
    }

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    const gameDataFetcherService = {
      fetchData: jest.fn(),
    }
    const searchEngine = {
      upsertGame: jest.fn(),
    }
    const activityService = {
      create: jest.fn(),
    }

    const service = new GameCreateService(
      gameDataFetcherService as any,
      prisma as any,
      searchEngine as any,
      activityService as any,
    )

    return {
      prisma,
      tx,
      gameDataFetcherService,
      searchEngine,
      activityService,
      service,
    }
  }

  const adminReq = { user: { sub: 7, role: ShionlibUserRoles.ADMIN } }
  const userReq = { user: { sub: 8, role: ShionlibUserRoles.USER } }

  const makeFetchedData = (overrides: Partial<any> = {}) => ({
    finalGameData: {
      b_id: 'b-1',
      v_id: 'v-1',
      title_jp: 'jp',
      title_zh: undefined,
      title_en: undefined,
      aliases: undefined,
      intro_jp: undefined,
      intro_zh: undefined,
      intro_en: undefined,
      extra_info: undefined,
      tags: undefined,
      staffs: undefined,
      nsfw: undefined,
      type: 'avg',
      platform: undefined,
      release_date: new Date('2024-01-02T00:00:00.000Z'),
      images: [
        {
          url: 'https://img/1',
          dims: [],
          sexual: 0,
          violence: 0,
        },
      ],
      links: [
        {
          url: 'https://example.com',
          label: 'homepage',
          name: 'official',
        },
      ],
      ...(overrides.finalGameData || {}),
    },
    finalCharactersData: [
      {
        v_id: 'char-v-1',
        b_id: 'char-b-1',
        name_jp: 'ch1',
        actor: 'actor-1',
      },
      {
        v_id: 'char-v-2',
        b_id: 'char-b-2',
        name_jp: 'ch2',
        birthday: [1, null, 2],
        gender: ['f', null, 'o'],
      },
    ],
    finalProducersData: [
      { v_id: 'dev-v-1', b_id: 'dev-b-1', name: '  dev1  ' },
      { v_id: 'dev-v-2', b_id: 'dev-b-2', name: 'dev2', aliases: ['a'] },
    ],
    finalCoversData: [
      {
        language: 'zh-hans',
        type: 'dig',
        url: 'https://cover/1',
        dims: [],
        sexual: 1,
        violence: 2,
      },
      {
        language: 'en',
        type: 'dig',
        url: 'https://cover/1',
        dims: [100, 200],
        sexual: 0,
        violence: 0,
      },
      {
        language: 'jp',
        type: 'pkgfront',
        url: 'https://cover/2',
        dims: [300, 400],
        sexual: 0,
        violence: 0,
      },
    ],
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    formatDocMock.mockReturnValue({ id: 1, indexed: true })
  })

  it('createFromBangumiAndVNDB validates permission and existing game', async () => {
    const { service, prisma } = createService()

    await expect(
      service.createFromBangumiAndVNDB('b-only', undefined, false, userReq as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_MISSING_BANGUMI_OR_VNDB_ID,
    })

    prisma.game.findFirst.mockResolvedValueOnce({ id: 1 })
    await expect(
      service.createFromBangumiAndVNDB('b-1', 'v-1', false, adminReq as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_ALREADY_EXISTS,
    })
  })

  it('createFromBangumiAndVNDB creates game with relations and syncs search', async () => {
    const { service, prisma, tx, gameDataFetcherService, searchEngine, activityService } =
      createService()

    prisma.game.findFirst.mockResolvedValueOnce(null)
    gameDataFetcherService.fetchData.mockResolvedValueOnce(makeFetchedData())
    tx.game.create.mockResolvedValueOnce({ id: 101 })
    tx.game.findUnique.mockResolvedValueOnce({ id: 101 })
    tx.gameDeveloper.findFirst.mockResolvedValueOnce({ id: 21 }).mockResolvedValueOnce(null)
    tx.gameDeveloper.create.mockResolvedValueOnce({ id: 22 })
    tx.gameCharacter.findFirst.mockResolvedValueOnce({ id: 31 }).mockResolvedValueOnce(null)
    tx.gameCharacter.create.mockResolvedValueOnce({ id: 32 })
    prisma.game.findUnique.mockResolvedValueOnce({ id: 101, title_jp: 'jp' })
    formatDocMock.mockReturnValueOnce({ id: 101, indexed: true })

    await expect(
      service.createFromBangumiAndVNDB('b-1', 'v-1', true, adminReq as any),
    ).resolves.toBe(101)

    expect(gameDataFetcherService.fetchData).toHaveBeenCalledWith('b-1', 'v-1', true)
    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          b_id: 'b-1',
          v_id: 'v-1',
          title_zh: '',
          aliases: [],
          intro_jp: '',
          extra_info: [],
          tags: [],
          staffs: [],
          nsfw: false,
          platform: [],
          creator_id: 7,
          release_date_tba: false,
        }),
      }),
    )
    expect(tx.gameCover.createMany).toHaveBeenCalledWith({
      data: [
        {
          game_id: 101,
          language: 'zh',
          type: 'dig',
          url: 'https://cover/1',
          dims: [0, 0],
          sexual: 1,
          violence: 2,
        },
        {
          game_id: 101,
          language: 'jp',
          type: 'pkgfront',
          url: 'https://cover/2',
          dims: [300, 400],
          sexual: 0,
          violence: 0,
        },
      ],
      skipDuplicates: true,
    })
    expect(tx.gameImage.createMany).toHaveBeenCalledWith({
      data: [{ game_id: 101, url: 'https://img/1', dims: [0, 0], sexual: 0, violence: 0 }],
    })
    expect(tx.gameLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          game_id: 101,
          url: 'https://example.com',
          label: 'homepage',
          name: 'official',
        },
      ],
    })
    expect(tx.gameDeveloperRelation.create).toHaveBeenCalledTimes(2)
    expect(tx.gameDeveloperRelation.create).toHaveBeenNthCalledWith(1, {
      data: { game_id: 101, developer_id: 21, role: '开发' },
    })
    expect(tx.gameDeveloperRelation.create).toHaveBeenNthCalledWith(2, {
      data: { game_id: 101, developer_id: 22, role: '开发' },
    })
    expect(tx.gameCharacterRelation.create).toHaveBeenCalledTimes(2)
    expect(tx.gameCharacterRelation.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ game_id: 101, character_id: 31, actor: 'actor-1' }),
      }),
    )
    expect(tx.gameCharacterRelation.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ game_id: 101, character_id: 32 }),
      }),
    )
    expect(tx.gameCharacter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          birthday: [1, 2],
          gender: ['f', 'o'],
        }),
      }),
    )
    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 7,
        game_id: 101,
      }),
      tx,
    )
    expect(formatDocMock).toHaveBeenCalledWith({ id: 101, title_jp: 'jp' })
    expect(searchEngine.upsertGame).toHaveBeenCalledWith({ id: 101, indexed: true })
  })

  it('createFromBangumiAndVNDB uses strict consistency for non-admin and handles invalid date', async () => {
    const { service, prisma, tx, gameDataFetcherService } = createService()

    prisma.game.findFirst.mockResolvedValueOnce(null)
    gameDataFetcherService.fetchData.mockResolvedValueOnce(
      makeFetchedData({
        finalGameData: {
          release_date: new Date('invalid'),
        },
        finalCharactersData: [],
        finalProducersData: [],
        finalCoversData: [],
      }),
    )
    tx.game.create.mockResolvedValueOnce({ id: 5 })
    tx.game.findUnique.mockResolvedValueOnce({ id: 5 })
    prisma.game.findUnique.mockResolvedValueOnce({ id: 5 })

    await service.createFromBangumiAndVNDB('b-1', 'v-1', true, userReq as any)

    expect(gameDataFetcherService.fetchData).toHaveBeenCalledWith('b-1', 'v-1', false)
    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          release_date: null,
          release_date_tba: true,
        }),
      }),
    )
  })

  it('createFromBangumiAndVNDB logs and rethrows transaction errors', async () => {
    const { service, prisma, gameDataFetcherService } = createService()
    const error = new Error('tx-fail')
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    prisma.game.findFirst.mockResolvedValueOnce(null)
    gameDataFetcherService.fetchData.mockResolvedValueOnce(makeFetchedData())
    prisma.$transaction.mockRejectedValueOnce(error)

    await expect(
      service.createFromBangumiAndVNDB('b-1', 'v-1', false, adminReq as any),
    ).rejects.toBe(error)
    expect(errorSpy).toHaveBeenCalledWith(error)

    errorSpy.mockRestore()
  })

  it('createFromBangumiAndVNDB throws when transaction returns 0 id', async () => {
    const { service, prisma, gameDataFetcherService } = createService()

    prisma.game.findFirst.mockResolvedValueOnce(null)
    gameDataFetcherService.fetchData.mockResolvedValueOnce(
      makeFetchedData({
        finalCharactersData: [],
        finalProducersData: [],
        finalCoversData: [],
      }),
    )
    prisma.$transaction.mockResolvedValueOnce(0)
    prisma.game.findUnique.mockResolvedValueOnce({ id: 0 })

    await expect(
      service.createFromBangumiAndVNDB('b-1', 'v-1', false, adminReq as any),
    ).rejects.toThrow('Game creation failed')
  })

  it('createGame validates duplication and fills default fields', async () => {
    const { service, prisma, searchEngine } = createService()

    prisma.game.findFirst.mockResolvedValueOnce({ id: 1 })
    await expect(
      service.createGame(
        {
          b_id: 'b-1',
          v_id: 'v-1',
        } as any,
        9,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_ALREADY_EXISTS,
    })

    prisma.game.findFirst.mockResolvedValueOnce(null)
    prisma.game.create.mockResolvedValueOnce({ id: 55, title_jp: 'new game' })
    formatDocMock.mockReturnValueOnce({ id: 55, indexed: true })

    await expect(
      service.createGame(
        {
          b_id: 'b-2',
          v_id: 'v-2',
          title_jp: 'new game',
          type: 'avg',
        } as any,
        9,
      ),
    ).resolves.toBe(55)

    expect(prisma.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          b_id: 'b-2',
          v_id: 'v-2',
          title_jp: 'new game',
          title_zh: '',
          title_en: '',
          aliases: [],
          intro_jp: '',
          intro_zh: '',
          intro_en: '',
          extra_info: [],
          tags: [],
          staffs: [],
          nsfw: false,
          platform: [],
          creator_id: 9,
        }),
      }),
    )
    expect(searchEngine.upsertGame).toHaveBeenCalledWith({ id: 55, indexed: true })
  })

  it('createCharacter validates game and duplicate relation, then creates relations', async () => {
    const { service, prisma, tx } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.createCharacter(
        {
          characters: [{ v_id: 'v-1', name_jp: 'c1' }],
        } as any,
        1,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({
      characters: [{ character: { v_id: 'v-1', b_id: 'b-1' } }],
    })
    await expect(
      service.createCharacter(
        {
          characters: [{ v_id: 'v-1', name_jp: 'c1' }],
        } as any,
        1,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_CHARACTER_ALREADY_EXISTS,
    })

    prisma.game.findUnique.mockResolvedValueOnce({ characters: [] })
    tx.gameCharacter.findFirst.mockResolvedValueOnce({ id: 40 }).mockResolvedValueOnce(null)
    tx.gameCharacter.create.mockResolvedValueOnce({ id: 41 })

    await service.createCharacter(
      {
        characters: [
          { v_id: 'v-exists', name_jp: 'old', actor: 'a1' },
          { v_id: 'v-new', name_jp: 'new', role: 'main', actor: 'a2' },
        ],
      } as any,
      99,
    )

    expect(tx.gameCharacterRelation.create).toHaveBeenNthCalledWith(1, {
      data: {
        game_id: 99,
        character_id: 40,
        image: undefined,
        actor: 'a1',
        role: null,
      },
    })
    expect(tx.gameCharacterRelation.create).toHaveBeenNthCalledWith(2, {
      data: {
        game_id: 99,
        character_id: 41,
        image: undefined,
        actor: 'a2',
        role: 'main',
      },
    })
  })

  it('createDeveloper validates game and duplicate relation, then creates relations', async () => {
    const { service, prisma, tx } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.createDeveloper(
        {
          developers: [{ v_id: 'v-1', name: 'd1' }],
        } as any,
        1,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({
      developers: [{ developer: { v_id: 'v-1', b_id: 'b-1' } }],
    })
    await expect(
      service.createDeveloper(
        {
          developers: [{ v_id: 'v-1', name: 'd1' }],
        } as any,
        1,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_ALREADY_EXISTS,
    })

    prisma.game.findUnique.mockResolvedValueOnce({ developers: [] })
    tx.gameDeveloper.findFirst.mockResolvedValueOnce({ id: 90 }).mockResolvedValueOnce(null)
    tx.gameDeveloper.create.mockResolvedValueOnce({ id: 91 })

    await service.createDeveloper(
      {
        developers: [
          { v_id: 'v-exists', name: 'old dev' },
          { v_id: 'v-new', name: 'new dev', role: '协力' },
        ],
      } as any,
      88,
    )

    expect(tx.gameDeveloperRelation.create).toHaveBeenNthCalledWith(1, {
      data: {
        game_id: 88,
        developer_id: 90,
        role: '开发',
      },
    })
    expect(tx.gameDeveloperRelation.create).toHaveBeenNthCalledWith(2, {
      data: {
        game_id: 88,
        developer_id: 91,
        role: '协力',
      },
    })
  })

  it('createCover validates game and duplication, then writes covers with normalized language', async () => {
    const { service, prisma, tx } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.createCover(
        {
          covers: [{ url: 'https://cover/1', language: 'jp', type: 'dig' }],
        } as any,
        1,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({
      covers: [{ url: 'https://cover/existing' }],
    })
    await expect(
      service.createCover(
        {
          covers: [{ url: 'https://cover/existing', language: 'jp', type: 'dig' }],
        } as any,
        1,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_COVER_ALREADY_EXISTS,
    })

    prisma.game.findUnique.mockResolvedValueOnce({ covers: [] })
    await service.createCover(
      {
        covers: [
          { url: 'https://cover/new', language: 'en-US', type: 'dig' },
          { url: 'https://cover/new2', language: '', type: 'pkgfront', dims: [10, 20] },
        ],
      } as any,
      77,
    )

    expect(tx.gameCover.createMany).toHaveBeenCalledWith({
      data: [
        {
          game_id: 77,
          language: 'en',
          type: 'dig',
          url: 'https://cover/new',
          dims: [0, 0],
          sexual: undefined,
          violence: undefined,
        },
        {
          game_id: 77,
          language: 'unknown',
          type: 'pkgfront',
          url: 'https://cover/new2',
          dims: [10, 20],
          sexual: undefined,
          violence: undefined,
        },
      ],
      skipDuplicates: true,
    })
  })
})
