jest.mock('../../search/helpers/format-doc', () => ({
  formatDoc: jest.fn(() => ({ id: 999, indexed: true })),
  rawDataQuery: { id: true },
}))

import { Prisma } from '@prisma/client'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import {
  RECENT_UPDATE_KEY,
  RECENT_UPDATE_TTL_MS,
} from '../../game/constants/recent-update.constant'
import { formatDoc, rawDataQuery } from '../../search/helpers/format-doc'
import { ADMIN_EDITABLE_GAME_SCALAR_FIELDS } from '../constants/game'
import { AdminGameService } from './admin-game.service'

describe('AdminGameService', () => {
  const formatDocMock = formatDoc as unknown as jest.Mock

  const createService = () => {
    const prisma = {
      game: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }

    const cacheService = {
      delByContains: jest.fn(),
      zrem: jest.fn(),
      zadd: jest.fn(),
      zremrangebyscore: jest.fn(),
    }

    const searchEngine = {
      upsertGame: jest.fn(),
      deleteGame: jest.fn(),
    }

    return {
      prisma,
      cacheService,
      searchEngine,
      service: new AdminGameService(prisma as any, cacheService as any, searchEngine as any),
    }
  }

  const getThrown = (fn: () => void) => {
    try {
      fn()
      return null
    } catch (error) {
      return error
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    formatDocMock.mockReturnValue({ id: 999, indexed: true })
  })

  it('getScalar returns selected fields and throws when not found', async () => {
    const { service, prisma } = createService()
    prisma.game.findUnique.mockResolvedValueOnce(null)

    await expect(service.getScalar(404)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    const scalar = { id: 1, title_zh: '标题', status: 2 }
    prisma.game.findUnique.mockResolvedValueOnce(scalar)

    const result = await service.getScalar(1)

    expect(prisma.game.findUnique).toHaveBeenLastCalledWith({
      where: { id: 1 },
      select: ADMIN_EDITABLE_GAME_SCALAR_FIELDS.reduce(
        (acc, field) => ({ ...acc, [field]: true }),
        {} as Prisma.GameSelect,
      ),
    })
    expect(result).toEqual(scalar)
  })

  it('updateStatus updates db and invalidates game caches', async () => {
    const { service, prisma, cacheService } = createService()
    prisma.game.update.mockResolvedValue({})

    await service.updateStatus(7, 3)

    expect(prisma.game.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: 3 },
    })
    expect(cacheService.delByContains.mock.calls.map(call => call[0])).toEqual(
      expect.arrayContaining(['game:7', 'game:list:', 'game:recent-update:']),
    )
  })

  it('editScalar validates existence and supports no-op payload', async () => {
    const { service, prisma, cacheService, searchEngine } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(service.editScalar(1, { title_zh: 'x' })).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({ id: 1 })
    await service.editScalar(1, { title_zh: undefined, not_allowed: 'x' })

    expect(prisma.game.update).not.toHaveBeenCalled()
    expect(searchEngine.upsertGame).not.toHaveBeenCalled()
    expect(cacheService.delByContains).not.toHaveBeenCalled()
  })

  it('editScalar normalizes payload, updates search index and invalidates caches', async () => {
    const { service, prisma, cacheService, searchEngine } = createService()
    prisma.game.findUnique.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 1 })
    prisma.game.update.mockResolvedValue({})

    await service.editScalar(1, {
      b_id: '',
      v_id: '  ',
      type: ' ',
      release_date: 0,
      extra_info: null,
      staffs: null,
      title_zh: '标题',
      status: 2,
      ignored_field: 'should be ignored',
    })

    expect(prisma.game.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        b_id: null,
        v_id: null,
        type: null,
        release_date: null,
        extra_info: [],
        staffs: [],
        title_zh: '标题',
        status: 2,
      },
    })
    expect(prisma.game.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 1 },
      select: rawDataQuery,
    })
    expect(formatDocMock).toHaveBeenCalledWith({ id: 1 })
    expect(searchEngine.upsertGame).toHaveBeenCalledWith({ id: 999, indexed: true })
    expect(cacheService.delByContains.mock.calls.map(call => call[0])).toEqual(
      expect.arrayContaining(['game:1', 'game:list:', 'game:recent-update:']),
    )
  })

  it('editScalar maps prisma known request errors', async () => {
    const { service, prisma } = createService()
    prisma.game.findUnique.mockResolvedValue({ id: 1 })

    prisma.game.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: '7.0.0',
      }),
    )
    await expect(service.editScalar(1, { title_zh: 'x' })).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '7.0.0',
      }),
    )
    await expect(service.editScalar(1, { title_zh: 'x' })).rejects.toMatchObject({
      code: ShionBizCode.GAME_ALREADY_EXISTS,
    })

    prisma.game.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('other', {
        code: 'P9999',
        clientVersion: '7.0.0',
      }),
    )
    await expect(service.editScalar(1, { title_zh: 'x' })).rejects.toMatchObject({
      code: ShionBizCode.COMMON_VALIDATION_FAILED,
    })
  })

  it('deleteById validates existence then deletes index/cache', async () => {
    const { service, prisma, cacheService, searchEngine } = createService()
    prisma.game.findUnique.mockResolvedValueOnce(null)

    await expect(service.deleteById(88)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({ id: 88 })
    prisma.game.delete.mockResolvedValue({})

    await service.deleteById(88)

    expect(prisma.game.delete).toHaveBeenCalledWith({ where: { id: 88 } })
    expect(searchEngine.deleteGame).toHaveBeenCalledWith(88)
    expect(cacheService.zrem).toHaveBeenCalledWith(RECENT_UPDATE_KEY, 88)
    expect(cacheService.delByContains.mock.calls.map(call => call[0])).toEqual(
      expect.arrayContaining(['game:88', 'game:list:', 'game:recent-update:']),
    )
  })

  it('addToRecentUpdate and removeFromRecentUpdate operate on zset and cache', async () => {
    const { service, cacheService } = createService()
    jest.spyOn(Date, 'now').mockReturnValueOnce(123_456)

    await service.addToRecentUpdate(5)
    await service.removeFromRecentUpdate(5)

    expect(cacheService.zadd).toHaveBeenCalledWith(RECENT_UPDATE_KEY, 123_456, 5)
    expect(cacheService.zremrangebyscore).toHaveBeenCalledWith(
      RECENT_UPDATE_KEY,
      '-inf',
      123_456 - RECENT_UPDATE_TTL_MS,
    )
    expect(cacheService.zrem).toHaveBeenCalledWith(RECENT_UPDATE_KEY, 5)
    expect(cacheService.delByContains).toHaveBeenCalledWith('game:recent-update:')
  })

  it('rethrowDatabaseErrorAsBiz handles prisma/classified errors and generic errors', () => {
    const { service } = createService()

    const biz = new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    const bizThrown = getThrown(() => (service as any).rethrowDatabaseErrorAsBiz(biz))
    expect(bizThrown).toBe(biz)

    const prismaUnknown = new Prisma.PrismaClientUnknownRequestError('unknown', {
      clientVersion: '7.0.0',
    })
    expect(
      getThrown(() => (service as any).rethrowDatabaseErrorAsBiz(prismaUnknown)),
    ).toMatchObject({
      code: ShionBizCode.COMMON_VALIDATION_FAILED,
    })

    const prismaValidation = new Prisma.PrismaClientValidationError('validation', {
      clientVersion: '7.0.0',
    })
    expect(
      getThrown(() => (service as any).rethrowDatabaseErrorAsBiz(prismaValidation)),
    ).toMatchObject({
      code: ShionBizCode.COMMON_VALIDATION_FAILED,
    })

    const prismaInit = new Prisma.PrismaClientInitializationError('init', '7.0.0', 'P1001')
    expect(getThrown(() => (service as any).rethrowDatabaseErrorAsBiz(prismaInit))).toMatchObject({
      code: ShionBizCode.COMMON_VALIDATION_FAILED,
    })

    const prismaPanic = new Prisma.PrismaClientRustPanicError('panic', '7.0.0')
    expect(getThrown(() => (service as any).rethrowDatabaseErrorAsBiz(prismaPanic))).toMatchObject({
      code: ShionBizCode.COMMON_VALIDATION_FAILED,
    })

    expect(
      getThrown(() => (service as any).rethrowDatabaseErrorAsBiz(new Error('boom'))),
    ).toMatchObject({
      code: ShionBizCode.COMMON_VALIDATION_FAILED,
    })
  })
})
