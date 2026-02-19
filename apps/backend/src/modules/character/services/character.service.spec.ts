import { PrismaService } from '../../../prisma.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { CharacterService } from './character.service'

describe('CharacterService', () => {
  function createService() {
    const prisma = {
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
      gameCharacter: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      gameCharacterRelation: {
        findMany: jest.fn(),
      },
    } as unknown as PrismaService

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (queries: Promise<any>[]) =>
      Promise.all(queries),
    )

    const service = new CharacterService(prisma)

    return {
      service,
      prisma,
    }
  }

  it('getCharacter throws when target does not exist', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.getCharacter(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_CHARACTER_NOT_FOUND,
    })
  })

  it('getCharacter returns selected fields when found', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      name_jp: 'jp',
      name_zh: 'zh',
      name_en: 'en',
      aliases: ['a'],
    })

    const result = await service.getCharacter(1)

    expect(prisma.gameCharacter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        select: expect.objectContaining({
          id: true,
          name_jp: true,
          name_zh: true,
          name_en: true,
          aliases: true,
        }),
      }),
    )
    expect(result).toMatchObject({ id: 1, name_jp: 'jp' })
  })

  it('getList returns paginated list without search query', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.count as jest.Mock).mockResolvedValue(2)
    ;(prisma.gameCharacter.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        b_id: 11,
        v_id: 21,
        name_jp: 'jp1',
        name_zh: 'zh1',
        name_en: 'en1',
        aliases: ['a1'],
        intro_jp: 'ij1',
        intro_zh: 'iz1',
        intro_en: 'ie1',
        image: 'img1',
      },
      {
        id: 2,
        b_id: 12,
        v_id: 22,
        name_jp: 'jp2',
        name_zh: 'zh2',
        name_en: 'en2',
        aliases: ['a2'],
        intro_jp: 'ij2',
        intro_zh: 'iz2',
        intro_en: 'ie2',
        image: 'img2',
      },
    ])

    const result = await service.getList({ page: 1, pageSize: 10, q: '' } as any)

    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(prisma.gameCharacter.count).toHaveBeenCalledWith({ where: {} })
    expect(prisma.gameCharacter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
        where: {},
      }),
    )
    expect(result.meta).toEqual({
      totalItems: 2,
      itemCount: 2,
      itemsPerPage: 10,
      totalPages: 1,
      currentPage: 1,
    })
    expect(result.items[0]).toMatchObject({ id: 1, name_jp: 'jp1' })
  })

  it('getList applies alias-like ids when query is provided', async () => {
    const { service, prisma } = createService()
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 8 }])
    ;(prisma.gameCharacter.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.gameCharacter.findMany as jest.Mock).mockResolvedValue([
      {
        id: 8,
        b_id: 18,
        v_id: 28,
        name_jp: 'query',
        name_zh: 'query',
        name_en: 'query',
        aliases: ['query'],
      },
    ])

    await service.getList({ page: 2, pageSize: 5, q: 'leaf moon' } as any)

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prisma.gameCharacter.count).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            name_jp: { contains: 'leaf moon', mode: 'insensitive' },
            name_zh: { contains: 'leaf moon', mode: 'insensitive' },
            name_en: { contains: 'leaf moon', mode: 'insensitive' },
            aliases: { hasSome: ['leaf', 'moon'] },
          },
          { id: { in: [8] } },
        ],
      },
    })
    expect(prisma.gameCharacter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      }),
    )
  })

  it('deleteById throws when character not found', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.deleteById(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_CHARACTER_NOT_FOUND,
    })
  })

  it('deleteById throws when character has relations', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
    ;(prisma.gameCharacterRelation.findMany as jest.Mock).mockResolvedValue([{ id: 99 }])

    await expect(service.deleteById(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_CHARACTER_HAS_RELATIONS,
    })
  })

  it('deleteById deletes and returns character when no relation exists', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({ id: 2, name_jp: 'n' })
    ;(prisma.gameCharacterRelation.findMany as jest.Mock).mockResolvedValue([])

    const result = await service.deleteById(2)

    expect(prisma.gameCharacter.delete).toHaveBeenCalledWith({ where: { id: 2 } })
    expect(result).toEqual({ id: 2, name_jp: 'n' })
  })
})
