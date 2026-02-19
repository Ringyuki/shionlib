jest.mock('argon2', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
  },
}))

jest.mock('../utils/verify-password.util', () => ({
  verifyPassword: jest.fn(),
}))

import argon2 from 'argon2'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import { UserContentLimit, UserLang } from '../interfaces/user.interface'
import { verifyPassword } from '../utils/verify-password.util'
import { UserInfoService } from './user-info.service'

describe('UserInfoService', () => {
  const argon2HashMock = argon2.hash as unknown as jest.Mock
  const verifyPasswordMock = verifyPassword as jest.Mock

  const createService = () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      userLoginSession: {
        updateMany: jest.fn(),
      },
    }

    const verificationCodeService = {
      request: jest.fn(),
      verify: jest.fn(),
    }

    const smallFileUploadService = {
      _uploadUserAvatar: jest.fn(),
    }

    return {
      prisma,
      verificationCodeService,
      smallFileUploadService,
      service: new UserInfoService(
        prisma as any,
        verificationCodeService as any,
        smallFileUploadService as any,
      ),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updateAvatar throws when file is missing', async () => {
    const { service } = createService()

    await expect(service.updateAvatar(undefined as any, 1)).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED,
    })
  })

  it('updateAvatar throws when file is too large', async () => {
    const { service } = createService()

    await expect(
      service.updateAvatar({ size: 5 * 1024 * 1024 + 1 } as any, 1),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT,
    })
  })

  it('updateAvatar uploads file and persists avatar key', async () => {
    const { service, smallFileUploadService, prisma } = createService()
    smallFileUploadService._uploadUserAvatar.mockResolvedValue({ key: 'avatar/u1.webp' })
    prisma.user.findUnique.mockResolvedValue({ id: 1 })

    const result = await service.updateAvatar({ size: 1024 } as any, 1)

    expect(result).toEqual({ key: 'avatar/u1.webp' })
    expect(smallFileUploadService._uploadUserAvatar).toHaveBeenCalledWith(1, { size: 1024 })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { avatar: 'avatar/u1.webp' },
    })
  })

  it('updateName throws when name already exists', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 99 })

    await expect(service.updateName('alice', 1)).rejects.toMatchObject({
      code: ShionBizCode.USER_NAME_ALREADY_EXISTS,
    })
  })

  it('updateName persists new name and returns payload', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 })

    const result = await service.updateName('alice', 1)

    expect(result).toEqual({ name: 'alice' })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'alice' },
    })
  })

  it('requestCode throws when user does not exist', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue(null)

    await expect(service.requestCode(1)).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })
  })

  it('requestCode delegates to verification service with user email', async () => {
    const { service, prisma, verificationCodeService } = createService()
    prisma.user.findUnique.mockResolvedValue({ email: 'old@example.com' })
    verificationCodeService.request.mockResolvedValue({ uuid: 'uuid-1' })

    const result = await service.requestCode(7)

    expect(result).toEqual({ uuid: 'uuid-1' })
    expect(verificationCodeService.request).toHaveBeenCalledWith('old@example.com', 60 * 30)
  })

  it('updateEmail verifies old/new emails, updates email and blocks sessions', async () => {
    const { service, prisma, verificationCodeService } = createService()
    prisma.user.findUniqueOrThrow.mockResolvedValue({ email: 'old@example.com' })
    prisma.user.findUnique.mockResolvedValue({ id: 1 })

    await service.updateEmail(
      {
        email: 'new@example.com',
        currentUuid: 'cu',
        currentCode: 'cc',
        newUuid: 'nu',
        newCode: 'nc',
      } as any,
      1,
    )

    expect(verificationCodeService.verify).toHaveBeenNthCalledWith(1, {
      uuid: 'cu',
      code: 'cc',
      email: 'old@example.com',
    })
    expect(verificationCodeService.verify).toHaveBeenNthCalledWith(2, {
      uuid: 'nu',
      code: 'nc',
      email: 'new@example.com',
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { email: 'new@example.com' },
    })
    expect(prisma.userLoginSession.updateMany).toHaveBeenCalledWith({
      where: { user_id: 1 },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: expect.any(Date),
        blocked_reason: 'user_email_changed',
      },
    })
  })

  it('updatePassword throws when user does not exist', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue(null)

    await expect(service.updatePassword('new-pass', 'old-pass', 1)).rejects.toMatchObject({
      code: ShionBizCode.USER_NOT_FOUND,
    })
  })

  it('updatePassword throws when old password is invalid', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique.mockResolvedValue({ id: 1, password: 'db-hash' })
    verifyPasswordMock.mockResolvedValue(false)

    await expect(service.updatePassword('new-pass', 'wrong-old', 1)).rejects.toMatchObject({
      code: ShionBizCode.USER_INVALID_PASSWORD,
    })
    expect(argon2HashMock).not.toHaveBeenCalled()
  })

  it('updatePassword hashes and persists new password then blocks sessions', async () => {
    const { service, prisma } = createService()
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, password: 'old-hash' })
      .mockResolvedValueOnce({ id: 1 })
    verifyPasswordMock.mockResolvedValue(true)
    argon2HashMock.mockResolvedValue('new-hash')

    await service.updatePassword('new-pass', 'old-pass', 1)

    expect(verifyPasswordMock).toHaveBeenCalledWith('old-pass', 'old-hash')
    expect(argon2HashMock).toHaveBeenCalledWith('new-pass')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { password: 'new-hash' },
    })
    expect(prisma.userLoginSession.updateMany).toHaveBeenCalledWith({
      where: { user_id: 1 },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: expect.any(Date),
        blocked_reason: 'user_password_changed',
      },
    })
  })

  it('updateLang validates enum value before persisting', async () => {
    const { service, prisma } = createService()

    await expect(service.updateLang('invalid', 1)).rejects.toMatchObject({
      code: ShionBizCode.USER_INVALID_LANG,
    })

    prisma.user.findUnique.mockResolvedValue({ id: 1 })
    await service.updateLang(UserLang.JA, 1)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { lang: UserLang.JA },
    })
  })

  it('updateContentLimit validates enum value before persisting', async () => {
    const { service, prisma } = createService()

    await expect(service.updateContentLimit(999, 1)).rejects.toMatchObject({
      code: ShionBizCode.USER_INVALID_CONTENT_LIMIT,
    })

    prisma.user.findUnique.mockResolvedValue({ id: 1 })
    await service.updateContentLimit(UserContentLimit.SHOW_WITH_SPOILER, 1)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { content_limit: UserContentLimit.SHOW_WITH_SPOILER },
    })
  })
})
