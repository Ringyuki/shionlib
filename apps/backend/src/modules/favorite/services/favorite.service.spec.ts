import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { FavoriteService } from './favorite.service'

describe('FavoriteService', () => {
  const createService = () => {
    const prisma = {
      favorite: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      game: {
        findUnique: jest.fn(),
      },
      favoriteItem: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    }

    return {
      prisma,
      service: new FavoriteService(prisma as any),
    }
  }

  it('createFavorite throws when duplicate name exists', async () => {
    const { service, prisma } = createService()
    prisma.favorite.findFirst.mockResolvedValue({ id: 1 })

    await expect(
      service.createFavorite({ name: 'A', description: 'd', is_private: false } as any, 1),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_ALREADY_EXISTS,
    })
  })

  it('createFavorite persists new list when name is unique', async () => {
    const { service, prisma } = createService()
    prisma.favorite.findFirst.mockResolvedValue(null)
    prisma.favorite.create.mockResolvedValue({ id: 2, name: 'A' })

    const result = await service.createFavorite(
      { name: 'A', description: 'd', is_private: true } as any,
      9,
    )

    expect(prisma.favorite.create).toHaveBeenCalledWith({
      data: {
        user_id: 9,
        name: 'A',
        description: 'd',
        is_private: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        is_private: true,
      },
    })
    expect(result).toEqual({ id: 2, name: 'A' })
  })

  it('deleteFavorite validates existence, ownership and default flag', async () => {
    const { service, prisma } = createService()

    prisma.favorite.findUnique.mockResolvedValueOnce(null)
    await expect(service.deleteFavorite(1, 9)).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NOT_FOUND,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 10, default: false })
    await expect(service.deleteFavorite(1, 9)).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NOT_OWNER,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 9, default: true })
    await expect(service.deleteFavorite(1, 9)).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_DEFAULT_NOT_ALLOW_DELETE,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 9, default: false })
    await service.deleteFavorite(1, 9)
    expect(prisma.favorite.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('updateFavorite validates ownership and duplicate target name', async () => {
    const { service, prisma } = createService()

    prisma.favorite.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.updateFavorite(1, 9, { name: 'new', description: 'd', is_private: false } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NOT_FOUND,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 10 })
    await expect(
      service.updateFavorite(1, 9, { name: 'new', description: 'd', is_private: false } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NOT_OWNER,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 9 })
    prisma.favorite.findFirst.mockResolvedValueOnce({ id: 2 })
    await expect(
      service.updateFavorite(1, 9, { name: 'dup', description: 'd', is_private: false } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NAME_ALREADY_EXISTS,
    })
  })

  it('updateFavorite updates when ownership and name are valid', async () => {
    const { service, prisma } = createService()
    prisma.favorite.findUnique.mockResolvedValue({ user_id: 9 })
    prisma.favorite.findFirst.mockResolvedValue({ id: 1 })

    await service.updateFavorite(1, 9, {
      name: 'renamed',
      description: 'desc',
      is_private: true,
    } as any)

    expect(prisma.favorite.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'renamed',
        description: 'desc',
        is_private: true,
      },
    })
  })

  it('addGameToFavorite validates favorite owner, game existence and duplicate item', async () => {
    const { service, prisma } = createService()

    prisma.favorite.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.addGameToFavorite(1, 9, { game_id: 11, note: 'n' } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NOT_FOUND,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 10 })
    await expect(
      service.addGameToFavorite(1, 9, { game_id: 11, note: 'n' } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NOT_OWNER,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 9 })
    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.addGameToFavorite(1, 9, { game_id: 11, note: 'n' } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 9 })
    prisma.game.findUnique.mockResolvedValueOnce({ id: 11 })
    prisma.favoriteItem.findFirst.mockResolvedValueOnce({ id: 22 })
    await expect(
      service.addGameToFavorite(1, 9, { game_id: 11, note: 'n' } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_ITEM_ALREADY_EXISTS,
    })
  })

  it('addGameToFavorite creates item when validation passes', async () => {
    const { service, prisma } = createService()
    prisma.favorite.findUnique.mockResolvedValue({ user_id: 9 })
    prisma.game.findUnique.mockResolvedValue({ id: 11 })
    prisma.favoriteItem.findFirst.mockResolvedValue(null)

    await service.addGameToFavorite(1, 9, { game_id: 11, note: 'memo' } as any)

    expect(prisma.favoriteItem.create).toHaveBeenCalledWith({
      data: {
        favorite_id: 1,
        game_id: 11,
        note: 'memo',
      },
    })
  })

  it('deleteFavoriteItemByGameId throws when mapping does not exist', async () => {
    const { service, prisma } = createService()
    prisma.favoriteItem.findFirst.mockResolvedValue(null)

    await expect(service.deleteFavoriteItemByGameId(1, 2, 9)).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_ITEM_NOT_FOUND,
    })
  })

  it('deleteFavoriteItemByGameId delegates to deleteFavoriteItem', async () => {
    const { service, prisma } = createService()
    prisma.favoriteItem.findFirst.mockResolvedValue({ id: 99 })
    const spy = jest.spyOn(service, 'deleteFavoriteItem').mockResolvedValue(undefined)

    await service.deleteFavoriteItemByGameId(1, 2, 9)

    expect(spy).toHaveBeenCalledWith(99, 9)
  })

  it('deleteFavoriteItem validates ownership and deletes item', async () => {
    const { service, prisma } = createService()

    prisma.favoriteItem.findFirst.mockResolvedValueOnce(null)
    await expect(service.deleteFavoriteItem(1, 9)).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_ITEM_NOT_FOUND,
    })

    prisma.favoriteItem.findFirst.mockResolvedValueOnce({ favorite: { user_id: 10 } })
    await expect(service.deleteFavoriteItem(1, 9)).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_ITEM_NOT_OWNER,
    })

    prisma.favoriteItem.findFirst.mockResolvedValueOnce({ favorite: { user_id: 9 } })
    await service.deleteFavoriteItem(1, 9)
    expect(prisma.favoriteItem.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('updateFavoriteItem validates ownership and updates note', async () => {
    const { service, prisma } = createService()

    prisma.favoriteItem.findUnique.mockResolvedValueOnce(null)
    await expect(service.updateFavoriteItem(1, 9, { note: 'x' } as any)).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_ITEM_NOT_FOUND,
    })

    prisma.favoriteItem.findUnique.mockResolvedValueOnce({ favorite: { user_id: 10 } })
    await expect(service.updateFavoriteItem(1, 9, { note: 'x' } as any)).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_ITEM_NOT_OWNER,
    })

    prisma.favoriteItem.findUnique.mockResolvedValueOnce({ favorite: { user_id: 9 } })
    await service.updateFavoriteItem(1, 9, { note: 'new-note' } as any)
    expect(prisma.favoriteItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { note: 'new-note' },
    })
  })

  it('getFavorites enforces auth for game filter and returns empty list early', async () => {
    const { service, prisma } = createService()

    await expect(
      service.getFavorites(undefined as any, { game_id: 1 } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.AUTH_UNAUTHORIZED,
    })

    prisma.favorite.findMany.mockResolvedValue([])
    const result = await service.getFavorites(9, {} as any)
    expect(result).toEqual([])
  })

  it('getFavorites applies privacy filter and marks per-game favorite status', async () => {
    const { service, prisma } = createService()
    prisma.favorite.findMany.mockResolvedValue([
      { id: 1, name: 'A', description: '', is_private: false, default: false },
      { id: 2, name: 'B', description: '', is_private: false, default: false },
    ])
    prisma.favoriteItem.groupBy.mockResolvedValue([
      { favorite_id: 1, _count: { favorite_id: 5 } },
      { favorite_id: 2, _count: { favorite_id: 1 } },
    ])
    prisma.favoriteItem.findMany.mockResolvedValue([{ favorite_id: 2 }])

    const result = await service.getFavorites(9, { user_id: 100, game_id: 88 } as any)

    expect(prisma.favorite.findMany).toHaveBeenCalledWith({
      where: { user_id: 100, is_private: false },
      select: {
        id: true,
        name: true,
        description: true,
        is_private: true,
        default: true,
      },
    })
    expect(result).toEqual([
      {
        id: 1,
        name: 'A',
        description: '',
        is_private: false,
        default: false,
        game_count: 5,
        is_favorite: false,
      },
      {
        id: 2,
        name: 'B',
        description: '',
        is_private: false,
        default: false,
        game_count: 1,
        is_favorite: true,
      },
    ])
  })

  it('getFavoriteItems validates visibility and returns paginated payload', async () => {
    const { service, prisma } = createService()

    prisma.favorite.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.getFavoriteItems(1, { page: 1, pageSize: 10 } as any, { user: { sub: 9 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NOT_FOUND,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 10, is_private: true })
    await expect(
      service.getFavoriteItems(1, { page: 1, pageSize: 10 } as any, { user: { sub: 9 } } as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.FAVORITE_NOT_ALLOW_VIEW,
    })

    prisma.favorite.findUnique.mockResolvedValueOnce({ user_id: 9, is_private: false })
    prisma.favoriteItem.count.mockResolvedValue(3)
    prisma.favoriteItem.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])

    const result = await service.getFavoriteItems(
      1,
      { page: 2, pageSize: 2 } as any,
      { user: { sub: 9, content_limit: 2 } } as any,
    )

    expect(result).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      meta: {
        totalItems: 3,
        itemCount: 2,
        itemsPerPage: 2,
        totalPages: 2,
        currentPage: 2,
        content_limit: 2,
      },
    })
  })

  it('getFavoriteStats returns boolean favorite status', async () => {
    const { service, prisma } = createService()
    prisma.favoriteItem.findFirst.mockResolvedValueOnce(null)
    prisma.favoriteItem.findFirst.mockResolvedValueOnce({ id: 1 })

    await expect(service.getFavoriteStats(9, 1)).resolves.toEqual({ is_favorite: false })
    await expect(service.getFavoriteStats(9, 1)).resolves.toEqual({ is_favorite: true })
  })
})
