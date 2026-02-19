import { VerificationCodeController } from './verification-code.controller'

describe('VerificationCodeController', () => {
  it('delegates request and verify actions to service', async () => {
    const verificationCodeService = {
      request: jest.fn(),
      verify: jest.fn(),
    }
    const controller = new VerificationCodeController(verificationCodeService as any)
    const requestDto = { email: 'foo@bar.com' }
    const verifyDto = { email: 'foo@bar.com', code: '123456' }

    await controller.request(requestDto as any)
    await controller.verify(verifyDto as any)

    expect(verificationCodeService.request).toHaveBeenCalledWith('foo@bar.com')
    expect(verificationCodeService.verify).toHaveBeenCalledWith(verifyDto)
  })
})
