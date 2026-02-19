import { PrismaService } from '../../../prisma.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { DeveloperService } from './developer.service'

describe('DeveloperService', () => {
  function createService() {
    const prisma = {
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
      gameDeveloper: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      gameDeveloperRelation: {
        findMany: jest.fn(),
      },
    } as unknown as PrismaService

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (queries: Promise<any>[]) =>
      Promise.all(queries),
    )

    const service = new DeveloperService(prisma)

    return {
      service,
      prisma,
    }
  }

  it('getList returns paginated developers without search query', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.count as jest.Mock).mockResolvedValue(2)
    ;(prisma.gameDeveloper.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'dev-a',
        aliases: ['a'],
        logo: 'logo-a',
        _count: { games: 7 },
      },
      {
        id: 2,
        name: 'dev-b',
        aliases: ['b'],
        logo: 'logo-b',
        _count: { games: 3 },
      },
    ])

    const result = await service.getList({ page: 1, pageSize: 10, q: '' } as any)

    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(prisma.gameDeveloper.count).toHaveBeenCalledWith({ where: {} })
    expect(prisma.gameDeveloper.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
        where: {},
        orderBy: { name: 'asc' },
      }),
    )
    expect(result).toEqual({
      items: [
        { id: 1, name: 'dev-a', aliases: ['a'], logo: 'logo-a', works_count: 7 },
        { id: 2, name: 'dev-b', aliases: ['b'], logo: 'logo-b', works_count: 3 },
      ],
      meta: {
        totalItems: 2,
        itemCount: 2,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      },
    })
  })

  it('getList applies alias-like ids when query is present', async () => {
    const { service, prisma } = createService()
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 11 }, { id: 12 }])
    ;(prisma.gameDeveloper.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.gameDeveloper.findMany as jest.Mock).mockResolvedValue([
      {
        id: 11,
        name: 'dev-search',
        aliases: ['search'],
        logo: 'logo-s',
        _count: { games: 1 },
      },
    ])

    await service.getList({ page: 2, pageSize: 5, q: 'leaf' } as any)

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prisma.gameDeveloper.count).toHaveBeenCalledWith({
      where: {
        OR: [{ name: { contains: 'leaf', mode: 'insensitive' } }, { id: { in: [11, 12] } }],
      },
    })
    expect(prisma.gameDeveloper.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: {
          OR: [{ name: { contains: 'leaf', mode: 'insensitive' } }, { id: { in: [11, 12] } }],
        },
      }),
    )
  })

  it('getById throws when developer does not exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.getById(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_NOT_FOUND,
    })
  })

  it('getById returns selected developer details', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 9 })
      .mockResolvedValueOnce({
        id: 9,
        name: 'dev-9',
        aliases: ['d9'],
        logo: 'logo-9',
        intro_jp: 'jp',
        intro_zh: 'zh',
        intro_en: 'en',
        website: 'https://dev9.test',
        extra_info: { key: 'value' },
        parent_developer: { id: 1, name: 'parent', aliases: ['p'] },
      })

    const result = await service.getById(9)

    expect(prisma.gameDeveloper.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: 9 },
    })
    expect(prisma.gameDeveloper.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 9 },
      select: expect.objectContaining({
        id: true,
        name: true,
        aliases: true,
        logo: true,
        parent_developer: expect.any(Object),
      }),
    })
    expect(result).toMatchObject({ id: 9, name: 'dev-9' })
  })

  it('deleteById throws when developer does not exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.deleteById(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_NOT_FOUND,
    })
  })

  it('deleteById throws when developer has relations', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({ id: 2 })
    ;(prisma.gameDeveloperRelation.findMany as jest.Mock).mockResolvedValue([{ id: 10 }])

    await expect(service.deleteById(2)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_HAS_RELATIONS,
    })
  })

  it('deleteById throws when developer has children', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({ id: 3 })
    ;(prisma.gameDeveloperRelation.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.gameDeveloper.findMany as jest.Mock).mockResolvedValue([{ id: 99 }])

    await expect(service.deleteById(3)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_HAS_CHILDREN,
    })
  })

  it('deleteById deletes developer when no blockers exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({ id: 4 })
    ;(prisma.gameDeveloperRelation.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.gameDeveloper.findMany as jest.Mock).mockResolvedValue([])

    await service.deleteById(4)

    expect(prisma.gameDeveloper.delete).toHaveBeenCalledWith({ where: { id: 4 } })
  })
})
