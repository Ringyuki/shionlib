import { UploadQuotaController } from './upload-quota.controller'

describe('UploadQuotaController', () => {
  it('delegates getQuota with request user id', async () => {
    const uploadQuotaService = {
      getUploadQuota: jest.fn(),
    }
    const controller = new UploadQuotaController(uploadQuotaService as any)
    const req = { user: { sub: 99 } }

    await controller.getQuota(req as any)

    expect(uploadQuotaService.getUploadQuota).toHaveBeenCalledWith(99)
  })
})
