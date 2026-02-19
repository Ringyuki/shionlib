import { PrismaService } from '../../../prisma.service'
import { PermissionEntity } from '../enums/permission-entity.enum'
import { PermissionService } from './permission.service'

describe('PermissionService', () => {
  function createService() {
    const prisma = {
      roleFieldPermission: {
        findUnique: jest.fn(),
      },
      userFieldPermission: {
        findUnique: jest.fn(),
      },
      fieldPermissionMapping: {
        findMany: jest.fn(),
      },
    } as unknown as PrismaService

    const service = new PermissionService(prisma)

    return {
      service,
      prisma,
    }
  }

  it('getAllowMaskFor merges role and user masks with bitwise OR', async () => {
    const { service, prisma } = createService()
    ;(prisma.roleFieldPermission.findUnique as jest.Mock).mockResolvedValue({ allowMask: 2 })
    ;(prisma.userFieldPermission.findUnique as jest.Mock).mockResolvedValue({ allowMask: 4 })

    const mask = await service.getAllowMaskFor(1, 2, PermissionEntity.GAME)

    expect(prisma.roleFieldPermission.findUnique).toHaveBeenCalledWith({
      where: { role_entity: { role: 2, entity: PermissionEntity.GAME } },
    })
    expect(prisma.userFieldPermission.findUnique).toHaveBeenCalledWith({
      where: { user_id_entity: { user_id: 1, entity: PermissionEntity.GAME } },
    })
    expect(mask).toBe(6n)
  })

  it('getAllowMaskFor falls back to 0 when no permission rows exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.roleFieldPermission.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.userFieldPermission.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.getAllowMaskFor(1, 1, PermissionEntity.CHARACTER)).resolves.toBe(0n)
  })

  it('ensureHasBits and hasBit validate bit presence correctly', () => {
    const { service } = createService()

    expect(service.ensureHasBits(0b1110n, 1, 2, 3)).toBe(true)
    expect(service.ensureHasBits(0b0110n, 1, 3)).toBe(false)

    expect(service.hasBit(0b1000n, 3)).toBe(true)
    expect(service.hasBit(0b1000n, 2)).toBe(false)
  })

  it('getPermissionDetails returns mapped fields and scalar/relation groups', async () => {
    const { service, prisma } = createService()
    jest.spyOn(service, 'getAllowMaskFor').mockResolvedValue(6n)
    ;(prisma.fieldPermissionMapping.findMany as jest.Mock).mockResolvedValue([
      { bitIndex: 1, field: 'TITLES', isRelation: false },
      { bitIndex: 2, field: 'MANAGE_IMAGES', isRelation: true },
      { bitIndex: 3, field: 'ALIASES', isRelation: false },
    ])

    const result = await service.getPermissionDetails(1, 2, PermissionEntity.GAME)

    expect(prisma.fieldPermissionMapping.findMany).toHaveBeenCalledWith({
      where: { entity: PermissionEntity.GAME },
      orderBy: { bitIndex: 'asc' },
    })
    expect(result.allowMask).toBe('6')
    expect(result.scalarFields).toEqual(['TITLES'])
    expect(result.relationFields).toEqual(['MANAGE_IMAGES'])
    expect(result.fields).toMatchObject({
      title_jp: true,
      title_zh: true,
      title_en: true,
      images: true,
      aliases: false,
    })
  })
})
