import { HttpStatus } from '@nestjs/common'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PotatoVNGameMappingService } from './potatovn-game-mapping.service'

const mockPvnGalgame = {
  id: 100,
  bgmId: 'b1',
  vndbId: 'v1',
  name: 'Game',
  cnName: '游戏',
  description: 'desc',
  imageUrl: null,
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
      },
      game: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    }
    const pvnApi = {
      get: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      put: jest.fn(),
      putRaw: jest.fn(),
    }
    const imageStorage = {
      getFile: jest.fn(),
    }
    const service = new PotatoVNGameMappingService(
      prisma as any,
      pvnApi as any,
      imageStorage as any,
    )
    return { service, prisma, pvnApi, imageStorage }
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

      expect(await service.getPvnGameData(10, 20)).toEqual(mapping)
      expect(prisma.userGamePvnMapping.findUnique).toHaveBeenCalledWith({
        where: { user_id_game_id: { user_id: 10, game_id: 20 } },
        select: expect.any(Object),
      })
    })

    it('throws PVN_GAME_MAPPING_NOT_FOUND when not found', async () => {
      const { service, prisma } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)

      const err = await service.getPvnGameData(10, 20).catch(e => e)
      expect(err.code).toBe(ShionBizCode.PVN_GAME_MAPPING_NOT_FOUND)
      expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND)
    })
  })

  describe('addGameToPvn', () => {
    it('returns existing mapping without calling PVN when already mapped', async () => {
      const { service, prisma, pvnApi } = createService()
      const existing = {
        pvn_galgame_id: 5,
        total_play_time: 30,
        last_play_date: null,
        play_type: 0,
        my_rate: 7,
        synced_at: new Date(),
      }
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(existing)

      expect(await service.addGameToPvn(10, 20)).toEqual(existing)
      expect(pvnApi.patch).not.toHaveBeenCalled()
    })

    it('throws GAME_NOT_FOUND when game does not exist', async () => {
      const { service, prisma } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)
      prisma.game.findUnique.mockResolvedValue(null)

      await expect(service.addGameToPvn(10, 999)).rejects.toMatchObject({
        code: ShionBizCode.GAME_NOT_FOUND,
      })
    })

    it('uploads cover to PVN OSS and creates mapping with imageLoc', async () => {
      const { service, prisma, pvnApi, imageStorage } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)
      prisma.game.findUnique.mockResolvedValue({
        v_id: 'v1',
        b_id: 'b1',
        title_jp: 'JP',
        title_zh: 'ZH',
        title_en: 'EN',
        tags: ['t'],
        covers: [{ url: 'cover-key.webp', sexual: 0, violence: 0 }],
        images: [],
        intro_zh: 'desc',
        intro_jp: null,
        intro_en: null,
        release_date: new Date(1000000000000),
      })
      const mockBody = {
        transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      }
      imageStorage.getFile.mockResolvedValue({ Body: mockBody, ContentType: 'image/webp' })
      pvnApi.get.mockResolvedValue('https://s3.pvn.example/presigned')
      pvnApi.putRaw.mockResolvedValue(undefined)
      pvnApi.put.mockResolvedValue(undefined)
      pvnApi.patch.mockResolvedValue(mockPvnGalgame)
      const created = {
        pvn_galgame_id: mockPvnGalgame.id,
        total_play_time: 120,
        last_play_date: new Date(1600000000000),
        play_type: 0,
        my_rate: 8,
        synced_at: new Date(),
      }
      prisma.userGamePvnMapping.create.mockResolvedValue(created)

      const result = await service.addGameToPvn(10, 20)

      expect(imageStorage.getFile).toHaveBeenCalledWith('cover-key.webp')
      expect(pvnApi.get).toHaveBeenCalledWith(
        10,
        '/oss/put',
        expect.objectContaining({ requireSpace: 3 }),
      )
      expect(pvnApi.putRaw).toHaveBeenCalledWith(
        'https://s3.pvn.example/presigned',
        expect.any(Buffer),
        'image/webp',
      )
      expect(pvnApi.put).toHaveBeenCalledWith(10, '/oss/update', expect.any(Object))
      expect(pvnApi.patch).toHaveBeenCalledWith(
        10,
        '/galgame',
        expect.objectContaining({
          bgmId: 'b1',
          vndbId: 'v1',
          imageLoc: expect.stringMatching(/^shionlib\/game\/20\/.+\.webp$/),
        }),
      )
      expect(result).toEqual(created)
    })

    it('creates mapping without imageLoc when no SFW covers exist', async () => {
      const { service, prisma, pvnApi, imageStorage } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)
      prisma.game.findUnique.mockResolvedValue({
        v_id: null,
        b_id: null,
        title_jp: null,
        title_zh: 'ZH',
        title_en: null,
        tags: [],
        covers: [],
        images: [],
        intro_zh: null,
        intro_jp: null,
        intro_en: null,
        release_date: null,
      })
      pvnApi.patch.mockResolvedValue({ ...mockPvnGalgame, playTime: [] })
      prisma.userGamePvnMapping.create.mockResolvedValue({
        pvn_galgame_id: 100,
        total_play_time: 0,
        last_play_date: null,
        play_type: 0,
        my_rate: 0,
        synced_at: new Date(),
      })

      await service.addGameToPvn(10, 20)

      expect(imageStorage.getFile).not.toHaveBeenCalled()
      const patchCall = pvnApi.patch.mock.calls[0][2]
      expect(patchCall).not.toHaveProperty('imageLoc')
    })

    it('still creates mapping when cover upload fails (non-fatal)', async () => {
      const { service, prisma, pvnApi, imageStorage } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)
      prisma.game.findUnique.mockResolvedValue({
        v_id: null,
        b_id: null,
        title_jp: 'JP',
        title_zh: null,
        title_en: null,
        tags: [],
        covers: [{ url: 'cover-key.webp', sexual: 0, violence: 0 }],
        images: [],
        intro_zh: null,
        intro_jp: null,
        intro_en: null,
        release_date: null,
      })
      imageStorage.getFile.mockRejectedValue(new Error('S3 error'))
      pvnApi.patch.mockResolvedValue({ ...mockPvnGalgame, playTime: [] })
      prisma.userGamePvnMapping.create.mockResolvedValue({
        pvn_galgame_id: 100,
        total_play_time: 0,
        last_play_date: null,
        play_type: 0,
        my_rate: 0,
        synced_at: new Date(),
      })

      await expect(service.addGameToPvn(10, 20)).resolves.toBeDefined()
      const patchCall = pvnApi.patch.mock.calls[0][2]
      expect(patchCall).not.toHaveProperty('imageLoc')
      expect(prisma.userGamePvnMapping.create).toHaveBeenCalled()
    })

    it('calls PUT /oss/update even when putRaw fails', async () => {
      const { service, prisma, pvnApi, imageStorage } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue(null)
      prisma.game.findUnique.mockResolvedValue({
        v_id: null,
        b_id: null,
        title_jp: 'JP',
        title_zh: null,
        title_en: null,
        tags: [],
        covers: [{ url: 'cover-key.webp', sexual: 0, violence: 0 }],
        images: [],
        intro_zh: null,
        intro_jp: null,
        intro_en: null,
        release_date: null,
      })
      const mockBody = {
        transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1])),
      }
      imageStorage.getFile.mockResolvedValue({ Body: mockBody, ContentType: 'image/webp' })
      pvnApi.get.mockResolvedValue('https://s3.pvn.example/presigned')
      pvnApi.putRaw.mockRejectedValue(new Error('upload failed'))
      pvnApi.put.mockResolvedValue(undefined)
      pvnApi.patch.mockResolvedValue({ ...mockPvnGalgame, playTime: [] })
      prisma.userGamePvnMapping.create.mockResolvedValue({
        pvn_galgame_id: 100,
        total_play_time: 0,
        last_play_date: null,
        play_type: 0,
        my_rate: 0,
        synced_at: new Date(),
      })

      await service.addGameToPvn(10, 20)

      expect(pvnApi.put).toHaveBeenCalledWith(10, '/oss/update', expect.any(Object))
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

    it('calls pvnApi.delete and removes local mapping on success', async () => {
      const { service, prisma, pvnApi } = createService()
      prisma.userGamePvnMapping.findUnique.mockResolvedValue({ pvn_galgame_id: 99 })
      pvnApi.delete.mockResolvedValue(undefined)
      prisma.userGamePvnMapping.delete.mockResolvedValue(undefined)

      await service.removeGameFromPvn(10, 20)

      expect(pvnApi.delete).toHaveBeenCalledWith(10, '/galgame/99')
      expect(prisma.userGamePvnMapping.delete).toHaveBeenCalledWith({
        where: { user_id_game_id: { user_id: 10, game_id: 20 } },
      })
    })
  })

  describe('syncLibrary', () => {
    it('fetches PVN games and upserts local mappings for matched games', async () => {
      const { service, prisma, pvnApi } = createService()
      pvnApi.get.mockResolvedValue({
        items: [mockPvnGalgame],
        pageCnt: 1,
        pageIndex: 0,
        pageSize: 50,
        cnt: 1,
      })
      prisma.game.findFirst.mockResolvedValue({ id: 1 })
      prisma.userGamePvnMapping.upsert.mockResolvedValue(undefined)

      await service.syncLibrary(1)

      expect(pvnApi.get).toHaveBeenCalledWith(1, '/galgame', {
        timestamp: 0,
        pageSize: 50,
        pageIndex: 0,
      })
      expect(prisma.userGamePvnMapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id_pvn_galgame_id: { user_id: 1, pvn_galgame_id: mockPvnGalgame.id },
          },
        }),
      )
    })

    it('does not throw when pvnApi.get fails (swallows sync errors)', async () => {
      const { service, pvnApi } = createService()
      pvnApi.get.mockRejectedValue(new Error('no binding'))

      await expect(service.syncLibrary(1)).resolves.toBeUndefined()
    })

    it('skips upsert for games not found locally but continues for others', async () => {
      const { service, prisma, pvnApi } = createService()
      const anotherGame = { ...mockPvnGalgame, id: 200, bgmId: 'b2', vndbId: 'v2' }
      pvnApi.get.mockResolvedValue({
        items: [mockPvnGalgame, anotherGame],
        pageCnt: 1,
        pageIndex: 0,
        pageSize: 50,
        cnt: 2,
      })
      prisma.game.findFirst.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null)
      prisma.userGamePvnMapping.upsert.mockResolvedValue(undefined)

      await service.syncLibrary(1)

      expect(prisma.userGamePvnMapping.upsert).toHaveBeenCalledTimes(1)
    })
  })
})
