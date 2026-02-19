jest.mock('../helpers/pick-changes', () => ({
  pickChanges: jest.fn(),
}))

jest.mock('../../edit/resolvers/permisson-resolver', () => ({
  gameRequiredBits: jest.fn(() => [0, 2]),
}))

jest.mock('../../search/helpers/format-doc', () => ({
  formatDoc: jest.fn(() => ({ id: 1, indexed: true })),
  rawDataQuery: { id: true },
}))

import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { gameRequiredBits } from '../../edit/resolvers/permisson-resolver'
import { pickChanges } from '../helpers/pick-changes'
import { formatDoc } from '../../search/helpers/format-doc'
import { GameEditService } from './game-edit.service'

describe('GameEditService', () => {
  const pickChangesMock = pickChanges as unknown as jest.Mock
  const gameRequiredBitsMock = gameRequiredBits as unknown as jest.Mock
  const formatDocMock = formatDoc as unknown as jest.Mock

  const createService = () => {
    const prisma = {
      game: {
        findUnique: jest.fn(),
      },
      gameLink: {
        findMany: jest.fn(),
      },
      gameCover: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      gameImage: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      gameDeveloperRelation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      gameDeveloper: {
        findUnique: jest.fn(),
      },
      gameCharacterRelation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      gameCharacter: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const tx = {
      game: {
        update: jest.fn(),
      },
      gameLink: {
        updateMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      gameCover: {
        update: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      gameImage: {
        update: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      gameDeveloperRelation: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      gameCharacterRelation: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      editRecord: {
        create: jest.fn().mockResolvedValue({ id: 900 }),
      },
    }

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

    const searchEngine = {
      upsertGame: jest.fn(),
    }
    const activityService = {
      create: jest.fn(),
    }
    const imageStorage = {
      deleteFile: jest.fn(),
    }

    const service = new GameEditService(
      prisma as any,
      searchEngine as any,
      activityService as any,
      imageStorage as any,
    )

    return {
      prisma,
      tx,
      searchEngine,
      activityService,
      imageStorage,
      service,
    }
  }

  const req = { user: { sub: 7, role: 2 } }

  beforeEach(() => {
    jest.clearAllMocks()
    gameRequiredBitsMock.mockReturnValue([0, 2])
    formatDocMock.mockReturnValue({ id: 1, indexed: true })
  })

  it('editGameScalar validates not-found and no-op branches', async () => {
    const { service, prisma } = createService()
    prisma.game.findUnique.mockResolvedValueOnce(null)

    await expect(
      service.editGameScalar(1, { title_zh: 'x' } as any, req as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({ id: 1, title_zh: 'same' })
    pickChangesMock.mockReturnValueOnce({ before: {}, after: {}, field_changes: [] })

    await service.editGameScalar(1, { title_zh: 'same' } as any, req as any)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('editGameScalar updates scalar fields, writes edit record/activity and syncs search', async () => {
    const { service, prisma, tx, activityService, searchEngine } = createService()
    prisma.game.findUnique
      .mockResolvedValueOnce({ id: 1, title_zh: 'old' })
      .mockResolvedValueOnce({ id: 1 })
    pickChangesMock.mockReturnValueOnce({
      before: { title_zh: 'old' },
      after: { title_zh: 'new' },
      field_changes: ['title_zh'],
    })
    gameRequiredBitsMock.mockReturnValueOnce([0, 2])

    await service.editGameScalar(
      1,
      {
        title_zh: 'new',
        note: 'n',
        extra_info: null,
        staffs: null,
      } as any,
      req as any,
    )

    expect(tx.game.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          title_zh: 'new',
          extra_info: undefined,
          staffs: undefined,
        }),
      }),
    )
    expect(tx.editRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          target_id: 1,
          field_mask: 5n,
          field_changes: ['title_zh'],
          note: 'n',
        }),
      }),
    )
    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        game_id: 1,
        user_id: 7,
        edit_record_id: 900,
      }),
      tx,
    )
    expect(formatDocMock).toHaveBeenCalledWith({ id: 1 })
    expect(searchEngine.upsertGame).toHaveBeenCalledWith({ id: 1, indexed: true })
  })

  it('links operations support no-op and success paths', async () => {
    const { service, prisma, tx, activityService } = createService()

    prisma.gameLink.findMany.mockResolvedValueOnce([])
    await service.editLinks(1, [{ id: 1, url: 'u', label: 'l', name: 'n' }] as any, req as any)
    expect(prisma.$transaction).not.toHaveBeenCalled()

    prisma.gameLink.findMany.mockResolvedValueOnce([{ id: 1, url: 'u0', label: 'l0', name: 'n0' }])
    await service.editLinks(1, [{ id: 1, url: 'u1', label: 'l1', name: 'n1' }] as any, req as any)
    expect(tx.gameLink.updateMany).toHaveBeenCalled()

    prisma.gameLink.findMany
      .mockResolvedValueOnce([{ url: 'dup', label: 'l', name: 'n' }])
      .mockResolvedValueOnce([{ url: 'dup', label: 'l', name: 'n' }])
    await service.addLinks(1, [{ url: 'dup', label: 'l', name: 'n' }] as any, req as any)
    await service.addLinks(
      1,
      [
        { url: 'dup', label: 'l', name: 'n' },
        { url: 'new', label: 'l2', name: 'n2' },
      ] as any,
      req as any,
    )
    expect(tx.gameLink.createMany).toHaveBeenCalledWith({
      data: [{ game_id: 1, url: 'new', label: 'l2', name: 'n2' }],
    })

    prisma.gameLink.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 2, url: 'u', label: 'l', name: 'n' }])
    await service.removeLinks(1, [2], req as any)
    await service.removeLinks(1, [2], req as any)
    expect(tx.gameLink.deleteMany).toHaveBeenCalledWith({ where: { game_id: 1, id: { in: [2] } } })
    expect(activityService.create).toHaveBeenCalled()
  })

  it('cover edit/add/remove handles no-op, min-cover guard and success', async () => {
    const { service, prisma, tx, imageStorage, searchEngine } = createService()

    prisma.gameCover.findUnique.mockResolvedValueOnce(null)
    await service.editCover(1, { id: 1, sexual: 1 } as any, req as any)
    expect(prisma.$transaction).not.toHaveBeenCalled()

    prisma.gameCover.findUnique.mockResolvedValueOnce({
      id: 1,
      url: 'c1',
      type: 1,
      dims: [1, 1],
      sexual: 1,
      violence: 1,
      language: 'jp',
    })
    pickChangesMock.mockReturnValueOnce({ field_changes: [] })
    await service.editCover(1, { id: 1, sexual: 1 } as any, req as any)

    prisma.gameCover.findUnique.mockResolvedValueOnce({
      id: 1,
      url: 'c1',
      type: 1,
      dims: [1, 1],
      sexual: 1,
      violence: 1,
      language: 'jp',
    })
    pickChangesMock.mockReturnValueOnce({ field_changes: ['sexual'] })
    tx.gameCover.update.mockResolvedValue({
      id: 1,
      url: 'c1',
      type: 1,
      dims: [1, 1],
      sexual: 2,
      violence: 1,
      language: 'jp',
    })
    prisma.game.findUnique.mockResolvedValue({ id: 1 })
    await service.editCover(1, { id: 1, sexual: 2 } as any, req as any)
    expect(tx.gameCover.update).toHaveBeenCalled()

    prisma.gameCover.findMany
      .mockResolvedValueOnce([{ url: 'dup', type: 1, dims: [1, 1], sexual: 1, violence: 1 }])
      .mockResolvedValueOnce([{ url: 'dup', type: 1, dims: [1, 1], sexual: 1, violence: 1 }])
    await service.addCovers(
      1,
      [{ url: 'dup', type: 1, dims: [1, 1], sexual: 1, violence: 1 } as any],
      req as any,
    )
    await service.addCovers(
      1,
      [
        { url: 'dup', type: 1, dims: [1, 1], sexual: 1, violence: 1, language: 'jp' } as any,
        { url: 'new', type: 1, dims: [1, 1], sexual: 1, violence: 1, language: 'jp' } as any,
      ],
      req as any,
    )
    expect(tx.gameCover.createMany).toHaveBeenCalled()

    prisma.gameCover.findMany.mockResolvedValueOnce([])
    await service.removeCovers(1, [1], req as any)

    prisma.gameCover.findMany
      .mockResolvedValueOnce([{ id: 1, url: 'c1', type: 1, dims: [1, 1], sexual: 1, violence: 1 }])
      .mockResolvedValueOnce([{ id: 1 }])
    await expect(service.removeCovers(1, [1], req as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_COVER_MIN_ONE_REQUIRED,
    })

    prisma.gameCover.findMany
      .mockResolvedValueOnce([
        { id: 1, url: 'c1', type: 1, dims: [1, 1], sexual: 1, violence: 1 },
        { id: 2, url: 'c2', type: 1, dims: [1, 1], sexual: 1, violence: 1 },
      ])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])
    await service.removeCovers(1, [1, 2], req as any)
    expect(tx.gameCover.deleteMany).toHaveBeenCalled()
    expect(imageStorage.deleteFile).toHaveBeenNthCalledWith(1, 'c1', false)
    expect(imageStorage.deleteFile).toHaveBeenNthCalledWith(2, 'c2', false)
    expect(searchEngine.upsertGame).toHaveBeenCalled()
  })

  it('image edit/add/remove handles branch paths and search sync', async () => {
    const { service, prisma, tx, imageStorage, searchEngine } = createService()

    prisma.gameImage.findUnique
      .mockResolvedValueOnce({ id: 1, game_id: 2, url: 'i1', dims: [1, 1], sexual: 1, violence: 1 })
      .mockResolvedValueOnce({ id: 1, game_id: 1, url: 'i1', dims: [1, 1], sexual: 1, violence: 1 })
      .mockResolvedValueOnce({ id: 1, game_id: 1, url: 'i1', dims: [1, 1], sexual: 1, violence: 1 })
    pickChangesMock
      .mockReturnValueOnce({ field_changes: [] })
      .mockReturnValueOnce({ field_changes: ['sexual'] })
    tx.gameImage.update.mockResolvedValue({
      id: 1,
      url: 'i1',
      dims: [1, 1],
      sexual: 2,
      violence: 1,
      character: { name_jp: 'a', name_zh: 'b', name_en: 'c' },
    })
    prisma.game.findUnique.mockResolvedValue({ id: 1 })

    await service.editImage(1, { id: 1, sexual: 2 } as any, req as any)
    await service.editImage(1, { id: 1, sexual: 1 } as any, req as any)
    await service.editImage(1, { id: 1, sexual: 2 } as any, req as any)
    expect(tx.gameImage.update).toHaveBeenCalledTimes(1)

    prisma.gameImage.findMany
      .mockResolvedValueOnce([{ url: 'dup', dims: [1, 1], sexual: 1, violence: 1 }])
      .mockResolvedValueOnce([{ url: 'dup', dims: [1, 1], sexual: 1, violence: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, url: 'i1', dims: [1, 1], sexual: 1, violence: 1 }])

    await service.addImages(
      1,
      [{ url: 'dup', dims: [1, 1], sexual: 1, violence: 1 } as any],
      req as any,
    )
    await service.addImages(
      1,
      [
        { url: 'dup', dims: [1, 1], sexual: 1, violence: 1 } as any,
        { url: 'new', dims: [1, 1], sexual: 1, violence: 1 } as any,
      ],
      req as any,
    )
    expect(tx.gameImage.createMany).toHaveBeenCalled()

    await service.removeImages(1, [1], req as any)
    await service.removeImages(1, [1], req as any)
    expect(tx.gameImage.deleteMany).toHaveBeenCalled()
    expect(imageStorage.deleteFile).toHaveBeenCalledWith('i1', false)
    expect(searchEngine.upsertGame).toHaveBeenCalled()
  })

  it('developer operations handle guards, no-op, success and wrapper sync', async () => {
    const { service, prisma, tx, searchEngine } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.addDevelopers(1, [{ developer_id: 1, role: 'dev' }] as any, req as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValue({ id: 1 })
    prisma.gameDeveloperRelation.findMany
      .mockResolvedValueOnce([{ developer_id: 1 }])
      .mockResolvedValueOnce([{ developer_id: 1 }])
    await service.addDevelopers(1, [{ developer_id: 1, role: 'dev' }] as any, req as any)
    await service.addDevelopers(
      1,
      [{ developer_id: 1, role: 'dev' } as any, { developer_id: 2, role: 'pub' } as any],
      req as any,
    )
    prisma.gameDeveloper.findUnique.mockResolvedValue({ name: 'Dev2' })
    expect(tx.gameDeveloperRelation.createMany).toHaveBeenCalled()

    prisma.gameDeveloperRelation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, developer_id: 1, role: 'dev', developer: { name: 'Dev1' } }])
      .mockResolvedValueOnce([{ developer_id: 1 }])
    await service.removeDevelopers(1, [1], req as any)
    await expect(service.removeDevelopers(1, [1], req as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_MIN_ONE_REQUIRED,
    })

    prisma.gameDeveloperRelation.findMany
      .mockResolvedValueOnce([{ id: 1, developer_id: 1, role: 'dev', developer: { name: 'Dev1' } }])
      .mockResolvedValueOnce([{ developer_id: 1 }, { developer_id: 2 }])
    await service.removeDevelopers(1, [1], req as any)
    expect(tx.gameDeveloperRelation.deleteMany).toHaveBeenCalled()

    prisma.gameDeveloperRelation.findUnique
      .mockResolvedValueOnce({
        id: 1,
        developer_id: 1,
        role: 'dev',
        game_id: 2,
        developer: { name: 'Dev1' },
      })
      .mockResolvedValueOnce({
        id: 1,
        developer_id: 1,
        role: 'dev',
        game_id: 1,
        developer: { name: 'Dev1' },
      })
      .mockResolvedValueOnce({
        id: 1,
        developer_id: 1,
        role: 'dev',
        game_id: 1,
        developer: { name: 'Dev1' },
      })
    pickChangesMock
      .mockReturnValueOnce({ field_changes: [] })
      .mockReturnValueOnce({ field_changes: ['role'] })
    tx.gameDeveloperRelation.update.mockResolvedValue({
      id: 1,
      developer_id: 1,
      role: 'pub',
      developer: { name: 'Dev1' },
    })
    await service.editDeveloper(1, { id: 1, role: 'pub' } as any, req as any)
    await service.editDeveloper(1, { id: 1, role: 'dev' } as any, req as any)
    await service.editDeveloper(1, { id: 1, role: 'pub' } as any, req as any)
    expect(tx.gameDeveloperRelation.update).toHaveBeenCalledTimes(1)

    const editDeveloperSpy = jest.spyOn(service, 'editDeveloper').mockResolvedValue(undefined)
    prisma.game.findUnique.mockResolvedValueOnce({ id: 1 })
    await service.editDevelopers(
      1,
      [
        { id: 1, role: 'a' },
        { id: 2, role: 'b' },
      ] as any,
      req as any,
    )
    expect(editDeveloperSpy).toHaveBeenCalledTimes(2)
    expect(searchEngine.upsertGame).toHaveBeenCalled()
  })

  it('character operations handle guards, no-op and success branches', async () => {
    const { service, prisma, tx, searchEngine } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.addCharacters(1, [{ character_id: 1, role: 'main' }] as any, req as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValue({ id: 1 })
    prisma.gameCharacterRelation.findMany
      .mockResolvedValueOnce([{ character_id: 1 }])
      .mockResolvedValueOnce([{ character_id: 1 }])
    await service.addCharacters(1, [{ character_id: 1, role: 'main' }] as any, req as any)
    prisma.gameCharacter.findUnique.mockResolvedValue({ name_jp: 'Char2' })
    await service.addCharacters(
      1,
      [
        { character_id: 1, role: 'main' } as any,
        { character_id: 2, role: 'sub', image: 'i', actor: 'a' } as any,
      ],
      req as any,
    )
    expect(tx.gameCharacterRelation.createMany).toHaveBeenCalled()

    prisma.gameCharacterRelation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 1,
          role: 'main',
          image: null,
          actor: null,
          character: { id: 1, name_jp: 'c1', name_zh: 'c1', name_en: 'c1' },
        },
      ])
      .mockResolvedValueOnce([{ character_id: 1 }])
    await service.removeCharacters(1, [1], req as any)
    await expect(service.removeCharacters(1, [1], req as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_CHARACTER_MIN_ONE_REQUIRED,
    })

    prisma.gameCharacterRelation.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          role: 'main',
          image: null,
          actor: null,
          character: { id: 1, name_jp: 'c1', name_zh: 'c1', name_en: 'c1' },
        },
      ])
      .mockResolvedValueOnce([{ character_id: 1 }, { character_id: 2 }])
    await service.removeCharacters(1, [1], req as any)
    expect(tx.gameCharacterRelation.deleteMany).toHaveBeenCalled()

    prisma.gameCharacterRelation.findUnique
      .mockResolvedValueOnce({
        id: 1,
        role: 'main',
        image: null,
        actor: null,
        game_id: 2,
        character: { id: 1, name_jp: 'c1', name_zh: 'c1', name_en: 'c1' },
      })
      .mockResolvedValueOnce({
        id: 1,
        role: 'main',
        image: null,
        actor: null,
        game_id: 1,
        character: { id: 1, name_jp: 'c1', name_zh: 'c1', name_en: 'c1' },
      })
      .mockResolvedValueOnce({
        id: 1,
        role: 'main',
        image: null,
        actor: null,
        game_id: 1,
        character: { id: 1, name_jp: 'c1', name_zh: 'c1', name_en: 'c1' },
      })
    pickChangesMock
      .mockReturnValueOnce({ field_changes: [] })
      .mockReturnValueOnce({ field_changes: ['role'] })
    tx.gameCharacterRelation.update.mockResolvedValue({
      id: 1,
      role: 'sub',
      image: null,
      actor: null,
      character: { id: 1, name_jp: 'c1', name_zh: 'c1', name_en: 'c1' },
    })
    await service.editCharacter(1, { id: 1, role: 'sub' } as any, req as any)
    await service.editCharacter(1, { id: 1, role: 'main' } as any, req as any)
    await service.editCharacter(1, { id: 1, role: 'sub' } as any, req as any)
    expect(tx.gameCharacterRelation.update).toHaveBeenCalledTimes(1)

    const editCharacterSpy = jest.spyOn(service, 'editCharacter').mockResolvedValue(undefined)
    await service.editCharacters(1, [{ id: 1 }, { id: 2 }] as any, req as any)
    expect(editCharacterSpy).toHaveBeenCalledTimes(2)
    expect(searchEngine.upsertGame).toHaveBeenCalled()
  })
})
