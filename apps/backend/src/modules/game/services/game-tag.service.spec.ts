import { GameTagService } from './game-tag.service'

describe('GameTagService', () => {
  const createService = () => {
    const tx = {
      tag: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      gameTagRelation: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    }
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
      tag: { findMany: jest.fn() },
    }
    const service = new GameTagService(prisma as any)
    return { service, prisma, tx }
  }

  describe('normalizeTag', () => {
    it('lowercases, trims, and collapses spaces', () => {
      const { service } = createService()
      expect(service.normalizeTag('  GalGame  ')).toBe('galgame')
      expect(service.normalizeTag('ADV Game')).toBe('adv game')
      expect(service.normalizeTag('GALGAME')).toBe('galgame')
    })
  })

  describe('resolveTag', () => {
    it('returns tagId and null alias when raw equals canonical', async () => {
      const { service, tx } = createService()
      tx.tag.findUnique.mockResolvedValue({ id: 1, name: 'galgame', aliases: [] })
      const result = await service.resolveTag(tx as any, 'galgame')
      expect(result).toEqual({ tagId: 1, alias: null })
      expect(tx.tag.update).not.toHaveBeenCalled()
    })

    it('returns tagId and alias when raw differs from canonical', async () => {
      const { service, tx } = createService()
      tx.tag.findUnique.mockResolvedValue({ id: 1, name: 'galgame', aliases: [] })
      tx.tag.update.mockResolvedValue({ id: 1, name: 'galgame', aliases: ['Galgame'] })
      const result = await service.resolveTag(tx as any, 'Galgame')
      expect(result).toEqual({ tagId: 1, alias: 'Galgame' })
    })

    it('finds by alias when canonical name not found', async () => {
      const { service, tx } = createService()
      tx.tag.findUnique.mockResolvedValue(null)
      tx.tag.findFirst.mockResolvedValue({ id: 2, name: 'rpg', aliases: ['RPG'] })
      const result = await service.resolveTag(tx as any, 'RPG')
      expect(result).toEqual({ tagId: 2, alias: 'RPG' })
    })

    it('creates new tag when not found anywhere', async () => {
      const { service, tx } = createService()
      tx.tag.findUnique.mockResolvedValue(null)
      tx.tag.findFirst.mockResolvedValue(null)
      tx.tag.create.mockResolvedValue({ id: 3, name: 'newgame', aliases: ['NewGame'] })
      const result = await service.resolveTag(tx as any, 'NewGame')
      expect(result).toEqual({ tagId: 3, alias: 'NewGame' })
      expect(tx.tag.create).toHaveBeenCalledWith({
        data: { name: 'newgame', aliases: ['NewGame'] },
      })
    })

    it('adds alias when raw differs from normalized and alias not yet stored', async () => {
      const { service, tx } = createService()
      tx.tag.findUnique.mockResolvedValue({ id: 4, name: 'adv', aliases: [] })
      tx.tag.update.mockResolvedValue({ id: 4, name: 'adv', aliases: ['ADV'] })
      const result = await service.resolveTag(tx as any, 'ADV')
      expect(result).toEqual({ tagId: 4, alias: 'ADV' })
      expect(tx.tag.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { aliases: { push: 'ADV' } },
      })
    })

    it('creates tag without alias when raw equals normalized', async () => {
      const { service, tx } = createService()
      tx.tag.findUnique.mockResolvedValue(null)
      tx.tag.findFirst.mockResolvedValue(null)
      tx.tag.create.mockResolvedValue({ id: 5, name: 'adv', aliases: [] })
      const result = await service.resolveTag(tx as any, 'adv')
      expect(result).toEqual({ tagId: 5, alias: null })
      expect(tx.tag.create).toHaveBeenCalledWith({ data: { name: 'adv', aliases: [] } })
    })
  })

  describe('setGameTags', () => {
    it('adds new tags and increments count', async () => {
      const { service, tx } = createService()
      tx.gameTagRelation.findMany.mockResolvedValue([])
      tx.tag.findUnique.mockResolvedValue({ id: 1, name: 'galgame', aliases: [] })

      await service.setGameTags(10, ['galgame'])

      expect(tx.gameTagRelation.createMany).toHaveBeenCalledWith({
        data: [{ game_id: 10, tag_id: 1, tag_alias: null }],
        skipDuplicates: true,
      })
      expect(tx.tag.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
        data: { count: { increment: 1 } },
      })
    })

    it('removes old tags and decrements count', async () => {
      const { service, tx } = createService()
      tx.gameTagRelation.findMany.mockResolvedValue([{ tag_id: 5 }])
      // no new tags
      await service.setGameTags(10, [])

      expect(tx.gameTagRelation.deleteMany).toHaveBeenCalledWith({
        where: { game_id: 10, tag_id: { in: [5] } },
      })
      expect(tx.tag.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [5] } },
        data: { count: { decrement: 1 } },
      })
    })

    it('no-ops when tags unchanged', async () => {
      const { service, tx } = createService()
      tx.gameTagRelation.findMany.mockResolvedValue([{ tag_id: 1 }])
      tx.tag.findUnique.mockResolvedValue({ id: 1, name: 'galgame', aliases: [] })

      await service.setGameTags(10, ['galgame'])

      expect(tx.gameTagRelation.createMany).not.toHaveBeenCalled()
      expect(tx.gameTagRelation.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe('searchTags', () => {
    it('queries tag table with normalized query ordered by count', async () => {
      const { service, prisma } = createService()
      prisma.tag.findMany.mockResolvedValue([{ name: 'galgame', count: 10 }])

      const result = await service.searchTags('GalGame', 5)

      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { name: { contains: 'galgame' } },
        orderBy: { count: 'desc' },
        take: 5,
        select: { name: true, count: true },
      })
      expect(result).toEqual([{ name: 'galgame', count: 10 }])
    })

    it('returns all tags when query is empty', async () => {
      const { service, prisma } = createService()
      prisma.tag.findMany.mockResolvedValue([])

      await service.searchTags('', 10)

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      )
    })
  })
})
