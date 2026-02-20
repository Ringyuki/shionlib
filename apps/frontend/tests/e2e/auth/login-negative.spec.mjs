import { expect, test } from '@playwright/test'

test.describe('Auth login negative cases', () => {
  test('should reject wrong password and unknown user without issuing auth cookies', async ({
    request,
  }) => {
    const wrongPasswordResponse = await request.post('/api/user/login', {
      data: {
        identifier: 'e2e_user',
        password: 'WrongPassword123!',
      },
    })
    expect(wrongPasswordResponse.status()).toBe(401)
    const wrongPasswordPayload = await wrongPasswordResponse.json()
    expect(wrongPasswordPayload?.code).not.toBe(0)
    expect(wrongPasswordResponse.headersArray().some(header => header.name === 'set-cookie')).toBe(
      false,
    )

    const unknownUserResponse = await request.post('/api/user/login', {
      data: {
        identifier: 'e2e_not_exist_user',
        password: 'ShionlibE2E123!',
      },
    })
    expect(unknownUserResponse.status()).toBe(404)
    const unknownUserPayload = await unknownUserResponse.json()
    expect(unknownUserPayload?.code).not.toBe(0)
    expect(unknownUserResponse.headersArray().some(header => header.name === 'set-cookie')).toBe(
      false,
    )
  })
})
