import { CharacterEditController } from './character-edit.controller'

describe('CharacterEditController', () => {
  it('delegates editCharacterScalar to service', async () => {
    const characterEditService = {
      editCharacterScalar: jest.fn(),
    }
    const characterFieldSyncService = {
      previewBatch: jest.fn(),
      apply: jest.fn(),
    }
    const controller = new CharacterEditController(
      characterEditService as any,
      characterFieldSyncService as any,
    )
    const dto = { name: 'char-a' }
    const req = { user: { sub: 1 } }

    await controller.editCharacterScalar(dto as any, 5, req as any)

    expect(characterEditService.editCharacterScalar).toHaveBeenCalledWith(5, dto, req)
  })

  it('delegates scalar sync endpoints to service', async () => {
    const characterEditService = {
      editCharacterScalar: jest.fn(),
    }
    const characterFieldSyncService = {
      previewBatch: jest.fn(),
      apply: jest.fn(),
    }
    const controller = new CharacterEditController(
      characterEditService as any,
      characterFieldSyncService as any,
    )
    const req = { user: { sub: 1 } }

    await controller.previewFieldSyncBatch({ fields: ['names', 'image'] } as any, 5)
    await controller.applyScalarSync(
      { field: 'names', candidateIds: ['c1'], note: 'sync' } as any,
      5,
      req as any,
    )

    expect(characterFieldSyncService.previewBatch).toHaveBeenCalledWith(5, ['names', 'image'])
    expect(characterFieldSyncService.apply).toHaveBeenCalledWith(5, 'names', ['c1'], req, 'sync')
  })
})
