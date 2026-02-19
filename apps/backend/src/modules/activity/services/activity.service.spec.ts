import { PrismaService } from '../../../prisma.service'
import { ActivityService } from './activity.service'

describe('ActivityService', () => {
  function createService() {
    const prisma = {
      activity: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService

    const service = new ActivityService(prisma)

    return {
      service,
      prisma,
    }
  }

  it('create writes activity through prisma when tx is not provided', async () => {
    const { service, prisma } = createService()

    await service.create({
      type: 1,
      user_id: 2,
      comment_id: 3,
      game_id: 4,
      edit_record_id: 5,
      developer_id: 6,
      character_id: 7,
      file_id: 8,
      file_status: 9,
      file_check_status: 10,
      file_size: 11,
      file_name: 'a.zip',
    } as any)

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: {
        type: 1,
        user_id: 2,
        comment_id: 3,
        game_id: 4,
        edit_record_id: 5,
        developer_id: 6,
        character_id: 7,
        file_id: 8,
        file_status: 9,
        file_check_status: 10,
        file_size: 11,
        file_name: 'a.zip',
      },
    })
  })

  it('create uses tx client when provided', async () => {
    const { service } = createService()
    const tx = {
      activity: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    }

    await service.create(
      {
        type: 1,
        user_id: 2,
      } as any,
      tx as any,
    )

    expect(tx.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 1,
        user_id: 2,
      }),
    })
  })

  it('getList returns mapped items with file fallback and pagination meta', async () => {
    const { service, prisma } = createService()
    ;(prisma.activity.count as jest.Mock).mockResolvedValue(5)
    ;(prisma.activity.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        type: 11,
        user: { id: 101, name: 'u1', avatar: 'a1' },
        game: { id: 201, title_jp: 'jp1', title_zh: 'zh1', title_en: 'en1' },
        comment: { id: 301, html: '<p>1</p>' },
        developer: { id: 401, name: 'dev1' },
        character: { id: 501, name_jp: 'cjp1', name_zh: 'czh1', name_en: 'cen1' },
        file: { id: 601, file_name: 'real.bin', file_size: 22 },
        file_status: 3,
        file_check_status: 2,
        file_size: null,
        file_name: null,
        created: new Date('2026-02-18T00:00:00.000Z'),
        updated: new Date('2026-02-18T00:00:00.000Z'),
      },
      {
        id: 2,
        type: 12,
        user: { id: 102, name: 'u2', avatar: 'a2' },
        game: null,
        comment: null,
        developer: null,
        character: null,
        file: null,
        file_status: 1,
        file_check_status: 0,
        file_size: 123,
        file_name: 'fallback.bin',
        created: new Date('2026-02-18T01:00:00.000Z'),
        updated: new Date('2026-02-18T01:00:00.000Z'),
      },
      {
        id: 3,
        type: 13,
        user: { id: 103, name: 'u3', avatar: 'a3' },
        game: null,
        comment: null,
        developer: null,
        character: null,
        file: null,
        file_status: null,
        file_check_status: null,
        file_size: null,
        file_name: null,
        created: new Date('2026-02-18T02:00:00.000Z'),
        updated: new Date('2026-02-18T02:00:00.000Z'),
      },
    ])

    const result = await service.getList({ page: 2, pageSize: 2 } as any)

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2,
        take: 2,
        orderBy: { created: 'desc' },
      }),
    )

    expect(result.meta).toEqual({
      totalItems: 5,
      itemCount: 3,
      itemsPerPage: 2,
      totalPages: 3,
      currentPage: 2,
    })

    expect(result.items[0].file).toEqual({
      id: 601,
      file_name: 'real.bin',
      file_size: 22,
      file_status: 3,
      file_check_status: 2,
    })

    expect(result.items[1].file).toEqual({
      id: 0,
      file_name: 'fallback.bin',
      file_size: 123,
      file_status: 1,
      file_check_status: 0,
    })

    expect(result.items[2].file).toBeUndefined()
  })
})
