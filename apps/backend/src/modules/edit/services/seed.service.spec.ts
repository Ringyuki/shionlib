import { PrismaService } from '../../../prisma.service'
import { PermissionEntity } from '../enums/permission-entity.enum'
import { SeedService } from './seed.service'

describe('SeedService', () => {
  function createService() {
    const prisma = {
      $transaction: jest.fn(),
    } as unknown as PrismaService

    const service = new SeedService(prisma)

    return {
      service,
      prisma,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('onModuleInit calls initSeed once when first attempt succeeds', async () => {
    const { service } = createService()
    const initSpy = jest.spyOn(service as any, 'initSeed').mockResolvedValue(undefined)

    await service.onModuleInit()

    expect(initSpy).toHaveBeenCalledTimes(1)
  })

  it('onModuleInit resets and retries when first initSeed fails', async () => {
    const { service } = createService()
    const initSpy = jest
      .spyOn(service as any, 'initSeed')
      .mockRejectedValueOnce(new Error('first-fail'))
      .mockResolvedValueOnce(undefined)
    const resetSpy = jest.spyOn(service as any, 'resetSeed').mockResolvedValue(undefined)

    await service.onModuleInit()

    expect(initSpy).toHaveBeenCalledTimes(2)
    expect(resetSpy).toHaveBeenCalledTimes(1)
  })

  it('onModuleInit rethrows original error when retry also fails', async () => {
    const { service } = createService()
    const firstError = new Error('first-fail')
    const secondError = new Error('second-fail')

    jest
      .spyOn(service as any, 'initSeed')
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError)
    jest.spyOn(service as any, 'resetSeed').mockResolvedValue(undefined)

    await expect(service.onModuleInit()).rejects.toBe(firstError)
  })

  it('initSeed upserts mappings and role permissions in one transaction', async () => {
    const { service, prisma } = createService()

    const upsertField = jest.fn().mockResolvedValue(undefined)
    const upsertRole = jest.fn().mockResolvedValue(undefined)

    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb =>
      cb({
        fieldPermissionMapping: { upsert: upsertField },
        roleFieldPermission: { upsert: upsertRole },
      }),
    )

    await (service as any).initSeed(
      [['IDS', 0, false]],
      [['NAMES', 1, false]],
      [['NAME', 2, false]],
    )

    expect(upsertField).toHaveBeenCalledWith({
      where: {
        entity_field: {
          entity: PermissionEntity.GAME,
          field: 'IDS',
        },
      },
      update: { bitIndex: 0, isRelation: false },
      create: { entity: PermissionEntity.GAME, field: 'IDS', bitIndex: 0, isRelation: false },
    })

    expect(upsertField).toHaveBeenCalledWith({
      where: { entity_field: { entity: PermissionEntity.CHARACTER, field: 'NAMES' } },
      update: { bitIndex: 1, isRelation: false },
      create: {
        entity: PermissionEntity.CHARACTER,
        field: 'NAMES',
        bitIndex: 1,
        isRelation: false,
      },
    })

    expect(upsertField).toHaveBeenCalledWith({
      where: { entity_field: { entity: PermissionEntity.DEVELOPER, field: 'NAME' } },
      update: { bitIndex: 2, isRelation: false },
      create: {
        entity: PermissionEntity.DEVELOPER,
        field: 'NAME',
        bitIndex: 2,
        isRelation: false,
      },
    })

    expect(upsertRole).toHaveBeenCalledTimes(9)
  })

  it('resetSeed clears mapping and role tables in one transaction', async () => {
    const { service, prisma } = createService()

    const deleteMappings = jest.fn().mockResolvedValue(undefined)
    const deleteRoles = jest.fn().mockResolvedValue(undefined)

    ;(prisma.$transaction as jest.Mock).mockImplementation(async cb =>
      cb({
        fieldPermissionMapping: { deleteMany: deleteMappings },
        roleFieldPermission: { deleteMany: deleteRoles },
      }),
    )

    await (service as any).resetSeed()

    expect(deleteMappings).toHaveBeenCalledTimes(1)
    expect(deleteRoles).toHaveBeenCalledTimes(1)
  })
})
