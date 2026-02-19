import { PrismaService } from '../../../prisma.service'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { DataService } from './data.service'

describe('Edit DataService', () => {
  function createService() {
    const prisma = {
      game: {
        findUnique: jest.fn(),
      },
      gameCover: {
        findMany: jest.fn(),
      },
      gameImage: {
        findMany: jest.fn(),
      },
      gameDeveloperRelation: {
        findMany: jest.fn(),
      },
      gameCharacterRelation: {
        findMany: jest.fn(),
      },
      editRecord: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      gameDeveloper: {
        findUnique: jest.fn(),
      },
      gameCharacter: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService

    const service = new DataService(prisma)

    return {
      service,
      prisma,
    }
  }

  it('getGameScalar throws when game is missing', async () => {
    const { service, prisma } = createService()
    ;(prisma.game.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.getGameScalar(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
  })

  it('getGameScalar returns selected game data', async () => {
    const { service, prisma } = createService()
    ;(prisma.game.findUnique as jest.Mock).mockResolvedValue({
      title_jp: 'jp',
      tags: ['tag1'],
    })

    await expect(service.getGameScalar(1)).resolves.toEqual({
      title_jp: 'jp',
      tags: ['tag1'],
    })
  })

  it('getGameCover/getGameImage/getGameDevelopers/getGameCharacters throw when game missing', async () => {
    const { service, prisma } = createService()
    ;(prisma.game.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.getGameCover(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
    await expect(service.getGameImage(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
    await expect(service.getGameDevelopers(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
    await expect(service.getGameCharacters(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
  })

  it('getGameCover/getGameImage/getGameDevelopers/getGameCharacters return relation lists', async () => {
    const { service, prisma } = createService()
    ;(prisma.game.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
    ;(prisma.gameCover.findMany as jest.Mock).mockResolvedValue([{ id: 11 }])
    ;(prisma.gameImage.findMany as jest.Mock).mockResolvedValue([{ id: 22 }])
    ;(prisma.gameDeveloperRelation.findMany as jest.Mock).mockResolvedValue([{ id: 33 }])
    ;(prisma.gameCharacterRelation.findMany as jest.Mock).mockResolvedValue([{ id: 44 }])

    await expect(service.getGameCover(1)).resolves.toEqual([{ id: 11 }])
    await expect(service.getGameImage(1)).resolves.toEqual([{ id: 22 }])
    await expect(service.getGameDevelopers(1)).resolves.toEqual([{ id: 33 }])
    await expect(service.getGameCharacters(1)).resolves.toEqual([{ id: 44 }])

    expect(prisma.gameCover.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { game_id: 1 } }),
    )
    expect(prisma.gameImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { game_id: 1 } }),
    )
    expect(prisma.gameDeveloperRelation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { game_id: 1 } }),
    )
    expect(prisma.gameCharacterRelation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { game_id: 1 } }),
    )
  })

  it('getGameEditHistory returns paginated edit records', async () => {
    const { service, prisma } = createService()
    ;(prisma.game.findUnique as jest.Mock).mockResolvedValue({ id: 1 })
    ;(prisma.editRecord.count as jest.Mock).mockResolvedValue(5)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([{ id: 101 }, { id: 102 }])

    const result = await service.getGameEditHistory(1, { page: 2, pageSize: 2 } as any)

    expect(prisma.editRecord.count).toHaveBeenCalledWith({
      where: { target_id: 1, entity: 'game' },
    })
    expect(prisma.editRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { target_id: 1, entity: 'game' },
        skip: 2,
        take: 2,
        orderBy: { created: 'desc' },
      }),
    )
    expect(result).toEqual({
      items: [{ id: 101 }, { id: 102 }],
      meta: {
        totalItems: 5,
        itemCount: 2,
        itemsPerPage: 2,
        totalPages: 3,
        currentPage: 2,
      },
    })
  })

  it('getDeveloperScalar throws when developer missing', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.getDeveloperScalar(2)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_NOT_FOUND,
    })
  })

  it('getDeveloperScalar and getDeveloperEditHistory return data when developer exists', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 2, name: 'dev' })
      .mockResolvedValueOnce({ id: 2 })
    ;(prisma.editRecord.count as jest.Mock).mockResolvedValue(3)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([{ id: 201 }])

    await expect(service.getDeveloperScalar(2)).resolves.toEqual({ id: 2, name: 'dev' })

    const history = await service.getDeveloperEditHistory(2, { page: 1, pageSize: 10 } as any)

    expect(prisma.editRecord.count).toHaveBeenCalledWith({
      where: { target_id: 2, entity: 'developer' },
    })
    expect(history).toEqual({
      items: [{ id: 201 }],
      meta: {
        totalItems: 3,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      },
    })
  })

  it('getDeveloperEditHistory throws when developer missing', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      service.getDeveloperEditHistory(2, { page: 1, pageSize: 10 } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_NOT_FOUND,
    })
  })

  it('getCharacterScalar throws when character missing', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(service.getCharacterScalar(3)).rejects.toMatchObject({
      code: ShionBizCode.GAME_CHARACTER_NOT_FOUND,
    })
  })

  it('getCharacterScalar and getCharacterEditHistory return data when character exists', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 3, name_jp: 'char' })
      .mockResolvedValueOnce({ id: 3 })
    ;(prisma.editRecord.count as jest.Mock).mockResolvedValue(4)
    ;(prisma.editRecord.findMany as jest.Mock).mockResolvedValue([{ id: 301 }, { id: 302 }])

    await expect(service.getCharacterScalar(3)).resolves.toEqual({ id: 3, name_jp: 'char' })

    const history = await service.getCharacterEditHistory(3, { page: 2, pageSize: 2 } as any)

    expect(prisma.editRecord.count).toHaveBeenCalledWith({
      where: { target_id: 3, entity: 'character' },
    })
    expect(history).toEqual({
      items: [{ id: 301 }, { id: 302 }],
      meta: {
        totalItems: 4,
        itemCount: 2,
        itemsPerPage: 2,
        totalPages: 2,
        currentPage: 2,
      },
    })
  })

  it('getCharacterEditHistory throws when character missing', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      service.getCharacterEditHistory(3, { page: 1, pageSize: 10 } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_CHARACTER_NOT_FOUND,
    })
  })
})
