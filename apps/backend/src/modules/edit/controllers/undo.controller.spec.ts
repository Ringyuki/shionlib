import { UndoController } from './undo.controller'

describe('UndoController', () => {
  it('delegates undo action to undo service', async () => {
    const undoService = {
      undo: jest.fn(),
    }
    const controller = new UndoController(undoService as any)
    const req = { user: { sub: 1 } }
    const dto = { reason: 'rollback', dryRun: false }

    await controller.undo(23, dto as any, req as any)

    expect(undoService.undo).toHaveBeenCalledWith(23, req, dto)
  })
})
