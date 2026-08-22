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

    const hikarinagi = {
      producer: jest.fn().mockResolvedValue(null),
      producerList: jest
        .fn()
        .mockResolvedValue({ items: [], meta: { total_items: 0, total_pages: 0 } }),
    }
    const service = new DeveloperService(prisma as any, hikarinagi as any)

    return {
      service,
      prisma,
      hikarinagi,
    }
  }

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

  describe('getList', () => {
    it('lists producers from upstream so the ids match what the detail route expects', async () => {
      const { service, prisma, hikarinagi } = createService()
      hikarinagi.producerList.mockResolvedValueOnce({
        items: [
          {
            id: 396,
            name: 'ゆずソフト',
            aliases: ['yuzu'],
            logo: { src: 'https://cdn/x.webp' },
            works_count: 13,
          },
        ],
        meta: { total_items: 1, total_pages: 1 },
      })

      const result = await service.getList({ page: 1, pageSize: 20, q: '' } as never)

      expect(hikarinagi.producerList).toHaveBeenCalledWith({
        page: 1,
        page_size: 20,
        search: undefined,
      })
      expect(prisma.gameDeveloper.findMany).not.toHaveBeenCalled()
      expect(result.items).toEqual([
        {
          id: 396,
          name: 'ゆずソフト',
          aliases: ['yuzu'],
          logo: 'https://cdn/x.webp',
          works_count: 13,
        },
      ])
      expect(result.meta.totalItems).toBe(1)
    })

    it('forwards the search keyword', async () => {
      const { service, hikarinagi } = createService()

      await service.getList({ page: 2, pageSize: 10, q: 'yuzu' } as never)

      expect(hikarinagi.producerList).toHaveBeenCalledWith({
        page: 2,
        page_size: 10,
        search: 'yuzu',
      })
    })

    it('degrades to an empty page when the upstream is not configured', async () => {
      const { service, hikarinagi } = createService()
      hikarinagi.producerList.mockResolvedValueOnce(null)

      const result = await service.getList({ page: 1, pageSize: 20 } as never)

      expect(result.items).toEqual([])
      expect(result.meta.totalItems).toBe(0)
    })
  })
})
