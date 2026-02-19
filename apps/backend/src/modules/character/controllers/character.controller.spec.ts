import { CharacterController } from './character.controller'

describe('CharacterController', () => {
  const createController = () => {
    const characterService = {
      getList: jest.fn(),
      getCharacter: jest.fn(),
      deleteById: jest.fn(),
    }

    return {
      characterService,
      controller: new CharacterController(characterService as any),
    }
  }

  it('delegates getList', async () => {
    const { controller, characterService } = createController()
    const dto = { q: 'heroine', page: 1 }

    await controller.getList(dto as any)

    expect(characterService.getList).toHaveBeenCalledWith(dto)
  })

  it('delegates getCharacter', async () => {
    const { controller, characterService } = createController()

    await controller.getCharacter(11)

    expect(characterService.getCharacter).toHaveBeenCalledWith(11)
  })

  it('delegates deleteCharacter', async () => {
    const { controller, characterService } = createController()

    await controller.deleteCharacter(22)

    expect(characterService.deleteById).toHaveBeenCalledWith(22)
  })
})
