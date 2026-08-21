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
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      gameDeveloperRelation: {
        findMany: jest.fn(),
      },
    } as unknown as PrismaService

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (queries: Promise<any>[]) =>
      Promise.all(queries),
    )

    const hikarinagi = { producer: jest.fn().mockResolvedValue(null) }
    const service = new DeveloperService(prisma as any, hikarinagi as any)

    return {
      service,
      prisma,
      hikarinagi,
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

  it('getById reads the entity through hikarinagi by its hikarinagi id', async () => {
    const { service, hikarinagi } = createService()
    hikarinagi.producer.mockResolvedValue({ name: 'x', aliases: [] })

    const result: any = await service.getById(77)

    expect(hikarinagi.producer).toHaveBeenCalledWith(77)
    expect(result.id).toBe(77)
    expect(result.h_id).toBe(77)
  })

  it('getById surfaces hikarinagi producer labels as extra_info, in label order', async () => {
    const { service, prisma, hikarinagi } = createService()
    hikarinagi.producer.mockResolvedValue({
      name: 'x',
      aliases: [],
      country: '日本',
      labels: [
        { key: '现任社长', value: '某人', order: 1 },
        { key: '官网', value: 'https://example.test', order: 0 },
      ],
    })

    const result: any = await service.getById(77)

    expect(result.extra_info).toEqual([
      { key: '官网', value: 'https://example.test' },
      { key: '现任社长', value: '某人' },
      { key: '国家/地区', value: '日本' },
    ])
    expect(prisma.gameDeveloper.findFirst).not.toHaveBeenCalled()
  })

  it('getById does not duplicate a country already present in the labels', async () => {
    const { service, hikarinagi } = createService()
    hikarinagi.producer.mockResolvedValue({
      name: 'x',
      aliases: [],
      country: '日本',
      labels: [{ key: '国家/地区', value: '日本国', order: 0 }],
    })

    const result: any = await service.getById(77)

    expect(result.extra_info).toEqual([{ key: '国家/地区', value: '日本国' }])
  })

  it('getById rejects when hikarinagi has no such entity', async () => {
    const { service, hikarinagi } = createService()
    hikarinagi.producer.mockResolvedValue(null)

    await expect(service.getById(999)).rejects.toBeDefined()
  })
})
