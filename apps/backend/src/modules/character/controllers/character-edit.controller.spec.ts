import { CharacterEditController } from './character-edit.controller'

describe('CharacterEditController', () => {
  it('delegates editCharacterScalar to service', async () => {
    const characterEditService = {
      editCharacterScalar: jest.fn(),
    }
    const controller = new CharacterEditController(characterEditService as any)
    const dto = { name: 'char-a' }
    const req = { user: { sub: 1 } }

    await controller.editCharacterScalar(dto as any, 5, req as any)

    expect(characterEditService.editCharacterScalar).toHaveBeenCalledWith(5, dto, req)
  })
})
