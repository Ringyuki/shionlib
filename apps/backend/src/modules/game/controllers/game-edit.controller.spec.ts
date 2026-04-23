import { GameEditController } from './game-edit.controller'

describe('GameEditController', () => {
  const createController = () => {
    const gameEditService = {
      editGameScalar: jest.fn(),
      editLinks: jest.fn(),
      addLinks: jest.fn(),
      removeLinks: jest.fn(),
      editCovers: jest.fn(),
      editCover: jest.fn(),
      addCovers: jest.fn(),
      removeCovers: jest.fn(),
      editImages: jest.fn(),
      editImage: jest.fn(),
      addImages: jest.fn(),
      removeImages: jest.fn(),
      addDevelopers: jest.fn(),
      removeDevelopers: jest.fn(),
      editDevelopers: jest.fn(),
      addCharacters: jest.fn(),
      removeCharacters: jest.fn(),
      editCharacters: jest.fn(),
      addGameRelations: jest.fn(),
      removeGameRelations: jest.fn(),
      editGameRelations: jest.fn(),
      syncRelationsFromBangumi: jest.fn(),
    }
    const gameFieldSyncService = {
      previewBatch: jest.fn(),
      apply: jest.fn(),
      applyScalar: jest.fn(),
    }
    return {
      gameEditService,
      gameFieldSyncService,
      controller: new GameEditController(gameEditService as any, gameFieldSyncService as any),
    }
  }

  it('delegates scalar/link/cover/image edit endpoints', async () => {
    const { controller, gameEditService } = createController()
    const req = { user: { sub: 1 } }

    await controller.editGameScalar({ title_zh: 'x' } as any, 1, req as any)
    await controller.editLinks({ links: [{ id: 1 }] } as any, 1, req as any)
    await controller.addLinks({ links: [{ label: 'a' }] } as any, 1, req as any)
    await controller.removeLinks({ ids: [1] } as any, 1, req as any)

    await controller.editCovers({ covers: [{ id: 1 }] } as any, 1, req as any)
    await controller.editCover({ id: 1, url: 'u' } as any, 1, req as any)
    await controller.addCovers({ covers: [{ url: 'u' }] } as any, 1, req as any)
    await controller.removeCovers({ ids: [2] } as any, 1, req as any)

    await controller.editImages({ images: [{ id: 3 }] } as any, 1, req as any)
    await controller.editImage({ id: 3, url: 'x' } as any, 1, req as any)
    await controller.addImages({ images: [{ url: 'img' }] } as any, 1, req as any)
    await controller.removeImages({ ids: [4] } as any, 1, req as any)

    expect(gameEditService.editGameScalar).toHaveBeenCalledWith(1, { title_zh: 'x' }, req)
    expect(gameEditService.editLinks).toHaveBeenCalledWith(1, [{ id: 1 }], req)
    expect(gameEditService.addLinks).toHaveBeenCalledWith(1, [{ label: 'a' }], req)
    expect(gameEditService.removeLinks).toHaveBeenCalledWith(1, [1], req)
    expect(gameEditService.editCovers).toHaveBeenCalledWith(1, [{ id: 1 }], req)
    expect(gameEditService.editCover).toHaveBeenCalledWith(1, { id: 1, url: 'u' }, req)
    expect(gameEditService.addCovers).toHaveBeenCalledWith(1, [{ url: 'u' }], req)
    expect(gameEditService.removeCovers).toHaveBeenCalledWith(1, [2], req)
    expect(gameEditService.editImages).toHaveBeenCalledWith(1, [{ id: 3 }], req)
    expect(gameEditService.editImage).toHaveBeenCalledWith(1, { id: 3, url: 'x' }, req)
    expect(gameEditService.addImages).toHaveBeenCalledWith(1, [{ url: 'img' }], req)
    expect(gameEditService.removeImages).toHaveBeenCalledWith(1, [4], req)
  })

  it('delegates developer and character relation endpoints', async () => {
    const { controller, gameEditService } = createController()
    const req = { user: { sub: 2 } }

    await controller.addDevelopers({ developers: [{ id: 1 }] } as any, 2, req as any)
    await controller.removeDevelopers({ ids: [1] } as any, 2, req as any)
    await controller.editDevelopers({ developers: [{ id: 2 }] } as any, 2, req as any)

    await controller.addCharacters({ characters: [{ id: 3 }] } as any, 2, req as any)
    await controller.removeCharacters({ ids: [3] } as any, 2, req as any)
    await controller.editCharacters({ characters: [{ id: 4 }] } as any, 2, req as any)

    expect(gameEditService.addDevelopers).toHaveBeenCalledWith(2, [{ id: 1 }], req)
    expect(gameEditService.removeDevelopers).toHaveBeenCalledWith(2, [1], req)
    expect(gameEditService.editDevelopers).toHaveBeenCalledWith(2, [{ id: 2 }], req)
    expect(gameEditService.addCharacters).toHaveBeenCalledWith(2, [{ id: 3 }], req)
    expect(gameEditService.removeCharacters).toHaveBeenCalledWith(2, [3], req)
    expect(gameEditService.editCharacters).toHaveBeenCalledWith(2, [{ id: 4 }], req)
  })

  it('delegates game relation endpoints', async () => {
    const { controller, gameEditService } = createController()
    const req = { user: { sub: 3 } }

    await controller.addGameRelations(
      { relations: [{ to_game_id: 10, relation: 'SEQUEL' }] } as any,
      5,
      req as any,
    )
    await controller.removeGameRelations({ ids: [1] } as any, 5, req as any)
    await controller.editGameRelations(
      { relations: [{ id: 1, relation: 'PREQUEL' }] } as any,
      5,
      req as any,
    )
    await controller.syncRelationsFromBangumi(5, req as any)

    expect(gameEditService.addGameRelations).toHaveBeenCalledWith(
      5,
      [{ to_game_id: 10, relation: 'SEQUEL' }],
      req,
    )
    expect(gameEditService.removeGameRelations).toHaveBeenCalledWith(5, [1], req)
    expect(gameEditService.editGameRelations).toHaveBeenCalledWith(
      5,
      [{ id: 1, relation: 'PREQUEL' }],
      req,
    )
    expect(gameEditService.syncRelationsFromBangumi).toHaveBeenCalledWith(5, req)
  })

  it('delegates field sync endpoints', async () => {
    const { controller, gameFieldSyncService } = createController()
    const req = { user: { sub: 4 } }
    const dto = { candidateIds: ['c1'] }

    await controller.previewFieldSyncBatch({ fields: ['links', 'titles'] } as any, 1)
    await controller.applyLinkSync(dto, 1, req as any)
    await controller.applyCoverSync(dto, 1, req as any)
    await controller.applyImageSync(dto, 1, req as any)
    await controller.applyDeveloperSync(dto, 1, req as any)
    await controller.applyCharacterSync(dto, 1, req as any)
    await controller.applyRelationSync(dto, 1, req as any)

    expect(gameFieldSyncService.previewBatch).toHaveBeenCalledWith(1, ['links', 'titles'])
    expect(gameFieldSyncService.apply).toHaveBeenCalledWith(1, 'links', ['c1'], req)
    expect(gameFieldSyncService.apply).toHaveBeenCalledWith(1, 'covers', ['c1'], req)
    expect(gameFieldSyncService.apply).toHaveBeenCalledWith(1, 'images', ['c1'], req)
    expect(gameFieldSyncService.apply).toHaveBeenCalledWith(1, 'developers', ['c1'], req)
    expect(gameFieldSyncService.apply).toHaveBeenCalledWith(1, 'characters', ['c1'], req)
    expect(gameFieldSyncService.apply).toHaveBeenCalledWith(1, 'relations', ['c1'], req)
  })

  it('delegates scalar sync endpoints', async () => {
    const { controller, gameFieldSyncService } = createController()
    const req = { user: { sub: 5 } }

    await controller.applyScalarSync(
      { field: 'tags', candidateIds: ['c1'], note: 'sync tags' } as any,
      1,
      req as any,
    )

    expect(gameFieldSyncService.applyScalar).toHaveBeenCalledWith(
      1,
      'tags',
      ['c1'],
      req,
      'sync tags',
    )
  })
})
