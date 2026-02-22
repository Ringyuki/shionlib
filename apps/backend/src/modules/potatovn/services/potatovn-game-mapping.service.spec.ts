import { HttpStatus } from '@nestjs/common'
import { of } from 'rxjs'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PotatoVNGameMappingService } from './potatovn-game-mapping.service'

const mockPvnGalgame = {
  id: 100,
  bgmId: 'b1',
  vndbId: 'v1',
  name: 'Game',
  cnName: '游戏',
  description: 'desc',
  imageUrl: 'https://img',
  headerImageUrl: null,
  tags: ['tag1'],
  releasedDateTimeStamp: 1000000,
  totalPlayTime: 120,
  playTime: [{ dateTimeStamp: 1600000000, minute: 60 }],
  playType: 0,
  myRate: 8,
}

describe('PotatoVNGameMappingService', () => {
  const createService = () => {
    const prisma = {
      userGamePvnMapping: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      userPvnBinding: {
        findUnique: jest.fn(),
      },
      game: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    }
    const httpService = {
      get: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    }
    const configService = {
      get: jest.fn().mockReturnValue('https://pvn.example'),
    }
    const service = new PotatoVNGameMappingService(
      prisma as any,
      httpService as any,
      configService as any,
    )
    return { service, prisma, httpService, configService }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getPvnGameData', () => {
    it('returns mapping when found', async () => {
      const { service, prisma } = createService()
      const mapping = {
        pvn_galgame_id: 1,
        total_play_time: 0,
        last_play_date: null,
        play_type: 0,
        my_rate: 0,
        synced_at: new Date(),
      }
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(mapping)

      const result = await service.getPvnGameData(10, 20)

      expect(prisma.userGamePvnMapping.findUnique).toHaveBeenCalledWith({
        where: { user_id_game_id: { user_id: 10, game_id: 20 } },
        select: expect.any(Object),
      })
      expect(result).toEqual(mapping)
    })

    it('throws PVN_GAME_MAPPING_NOT_FOUND when mapping not found', async () => {
      const { service, prisma } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)

      const err = await service.getPvnGameData(10, 20).catch(e => e)
      expect(err.code).toBe(ShionBizCode.PVN_GAME_MAPPING_NOT_FOUND)
      expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND)
    })
  })

  describe('addGameToPvn', () => {
    it('returns existing mapping when already mapped', async () => {
      const { service, prisma } = createService()
      const existing = {
        pvn_galgame_id: 5,
        total_play_time: 30,
        last_play_date: null,
        play_type: 0,
        my_rate: 7,
        synced_at: new Date(),
      }
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(existing)

      const result = await service.addGameToPvn(10, 20)

      expect(result).toEqual(existing)
      expect(prisma.game.findUnique).not.toHaveBeenCalled()
      expect(prisma.userGamePvnMapping.create).not.toHaveBeenCalled()
    })

    it('throws GAME_NOT_FOUND when game does not exist', async () => {
      const { service, prisma } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)
      prisma.userPvnBinding.findUnique.mockResolvedValue({
        pvn_token: 'token',
      })
      prisma.game.findUnique.mockResolvedValue(null)

      await expect(service.addGameToPvn(10, 999)).rejects.toMatchObject({
        code: ShionBizCode.GAME_NOT_FOUND,
      })
    })

    it('throws PVN_BINDING_NOT_FOUND when user has no PVN binding', async () => {
      const { service, prisma } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)
      prisma.userPvnBinding.findUnique.mockResolvedValue(null)

      await expect(service.addGameToPvn(10, 20)).rejects.toMatchObject({
        code: ShionBizCode.PVN_BINDING_NOT_FOUND,
      })
    })

    it('creates mapping and returns when game exists and binding exists', async () => {
      const { service, prisma, httpService } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)
      prisma.userPvnBinding.findUnique.mockResolvedValue({
        pvn_token: 'pvn-token',
      })
      prisma.game.findUnique.mockResolvedValue({
        v_id: 'v1',
        b_id: 'b1',
        title_jp: 'JP',
        title_zh: 'ZH',
        title_en: 'EN',
        tags: ['t'],
        covers: [{ url: 'cover', sexual: 0, violence: 0 }],
        images: [],
        intro_jp: null,
        intro_zh: null,
        intro_en: null,
        release_date: new Date(1000000000000),
      })
      httpService.patch.mockReturnValue(of({ data: mockPvnGalgame }))
      const created = {
        pvn_galgame_id: mockPvnGalgame.id,
        total_play_time: mockPvnGalgame.totalPlayTime,
        last_play_date: new Date(mockPvnGalgame.playTime[0].dateTimeStamp * 1000),
        play_type: mockPvnGalgame.playType,
        my_rate: mockPvnGalgame.myRate,
        synced_at: new Date(),
      }
      prisma.userGamePvnMapping.create.mockResolvedValue(created)

      const result = await service.addGameToPvn(10, 20)

      expect(httpService.patch).toHaveBeenCalledWith(
        'https://pvn.example/galgame',
        expect.objectContaining({
          bgmId: 'b1',
          vndbId: 'v1',
          name: 'JP',
          cnName: 'ZH',
          playType: 0,
        }),
        { headers: { Authorization: 'Bearer pvn-token' } },
      )
      expect(prisma.userGamePvnMapping.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 10,
          game_id: 20,
          pvn_galgame_id: mockPvnGalgame.id,
          total_play_time: mockPvnGalgame.totalPlayTime,
          play_type: mockPvnGalgame.playType,
          my_rate: mockPvnGalgame.myRate,
        }),
        select: expect.any(Object),
      })
      expect(result).toEqual(created)
    })
  })

  describe('removeGameFromPvn', () => {
    it('throws PVN_GAME_MAPPING_NOT_FOUND when mapping does not exist', async () => {
      const { service, prisma } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)

      await expect(service.removeGameFromPvn(10, 20)).rejects.toMatchObject({
        code: ShionBizCode.PVN_GAME_MAPPING_NOT_FOUND,
      })
    })

    it('throws PVN_BINDING_NOT_FOUND when user has no PVN binding', async () => {
      const { service, prisma } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue({ pvn_galgame_id: 99 })
      prisma.userPvnBinding.findUnique.mockResolvedValue(null)

      await expect(service.removeGameFromPvn(10, 20)).rejects.toMatchObject({
        code: ShionBizCode.PVN_BINDING_NOT_FOUND,
      })
    })

    it('calls PVN DELETE and removes local mapping on success', async () => {
      const { service, prisma, httpService } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue({ pvn_galgame_id: 99 })
      prisma.userPvnBinding.findUnique.mockResolvedValue({ pvn_token: 'pvn-token' })
      httpService.delete.mockReturnValue(of({ data: undefined }))
      prisma.userGamePvnMapping.delete.mockResolvedValue(undefined)

      await service.removeGameFromPvn(10, 20)

      expect(httpService.delete).toHaveBeenCalledWith('https://pvn.example/galgame/99', {
        headers: { Authorization: 'Bearer pvn-token' },
      })
      expect(prisma.userGamePvnMapping.delete).toHaveBeenCalledWith({
        where: { user_id_game_id: { user_id: 10, game_id: 20 } },
      })
    })
  })

  describe('syncLibrary', () => {
    it('fetches token, fetches PVN galgames, upserts mapping for each', async () => {
      const { service, prisma, httpService } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue({
        pvn_token: 'token',
      })
      prisma.game.findFirst.mockResolvedValue({ id: 1 })
      httpService.get.mockReturnValue(
        of({
          data: {
            items: [mockPvnGalgame],
            pageCnt: 1,
            pageIndex: 0,
            pageSize: 50,
            cnt: 1,
          },
        }),
      )
      prisma.userGamePvnMapping.upsert.mockResolvedValue(undefined)

      await service.syncLibrary(1)

      expect(prisma.userPvnBinding.findUnique).toHaveBeenCalledWith({
        where: { user_id: 1 },
        select: { pvn_token: true },
      })
      expect(httpService.get).toHaveBeenCalledWith(
        'https://pvn.example/galgame',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token' },
          params: { timestamp: 0, pageSize: 50, pageIndex: 0 },
        }),
      )
      expect(prisma.game.findFirst).toHaveBeenCalled()
      expect(prisma.userGamePvnMapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id_pvn_galgame_id: { user_id: 1, pvn_galgame_id: mockPvnGalgame.id } },
        }),
      )
    })

    it('catches and logs when user has no binding (does not throw)', async () => {
      const { service, prisma } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue(null)

      await expect(service.syncLibrary(1)).resolves.toBeUndefined()
      expect(prisma.userGamePvnMapping.upsert).not.toHaveBeenCalled()
    })
  })
})
