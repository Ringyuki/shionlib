import { DeveloperEditController } from './developer-edit.controller'

describe('DeveloperEditController', () => {
  it('delegates editDeveloperScalar to service', async () => {
    const developerEditService = {
      editDeveloperScalar: jest.fn(),
    }
    const controller = new DeveloperEditController(developerEditService as any)
    const dto = { name: 'dev-a' }
    const req = { user: { sub: 1 } }

    await controller.editDeveloperScalar(dto as any, 7, req as any)

    expect(developerEditService.editDeveloperScalar).toHaveBeenCalledWith(7, dto, req)
  })
})
