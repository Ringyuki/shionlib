jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn(() => 'mock-uuid'),
}))

import { TargetFormatEnum } from '../../image/dto/req/image-process.req.dto'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { SMALL_FILE_UPLOAD_FILE_SIZE_SOFT_LIMIT } from '../constants/upload.constants'
import { SmallFileUploadService } from './small-file-upload.service'

describe('SmallFileUploadService', () => {
  const createService = () => {
    const s3Service = {
      uploadFile: jest.fn(),
    }
    const imageProcessService = {
      process: jest.fn(),
    }
    const prismaService = {
      game: {
        findUnique: jest.fn(),
      },
      gameDeveloper: {
        findUnique: jest.fn(),
      },
      gameCharacter: {
        findUnique: jest.fn(),
      },
    }

    const service = new SmallFileUploadService(
      s3Service as any,
      imageProcessService as any,
      prismaService as any,
    )

    return {
      s3Service,
      imageProcessService,
      prismaService,
      service,
    }
  }

  const reqUser = { user: { sub: 9, role: ShionlibUserRoles.USER } }
  const reqAdmin = { user: { sub: 1, role: ShionlibUserRoles.ADMIN } }
  const processResult = {
    data: Buffer.from('processed-image'),
    format: 'webp',
    info: {} as any,
    filenameSuffix: '.webp',
    mime: 'image/webp',
  }

  const makeFile = (size = 1024) =>
    ({
      buffer: Buffer.from('raw-image'),
      size,
      mimetype: 'image/png',
      originalname: 'img.png',
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).fetch = jest.fn(async () => ({
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    }))
  })

  it('uploadGameCover validates game existence, file presence and user size limit', async () => {
    const { service, prismaService } = createService()

    prismaService.game.findUnique.mockResolvedValueOnce(null)
    await expect(service.uploadGameCover(1, makeFile(), reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prismaService.game.findUnique.mockResolvedValueOnce({ id: 1 })
    await expect(
      service.uploadGameCover(1, undefined as any, reqUser as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED,
    })

    prismaService.game.findUnique.mockResolvedValueOnce({ id: 1 })
    await expect(
      service.uploadGameCover(
        1,
        makeFile(SMALL_FILE_UPLOAD_FILE_SIZE_SOFT_LIMIT + 1),
        reqUser as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT,
    })
  })

  it('uploadGameCover processes and uploads image', async () => {
    const { service, prismaService, imageProcessService, s3Service } = createService()
    prismaService.game.findUnique.mockResolvedValueOnce({ id: 1 })
    imageProcessService.process.mockResolvedValueOnce(processResult)

    await expect(service.uploadGameCover(1, makeFile(), reqUser as any)).resolves.toEqual({
      key: 'game/1/cover/mock-uuid.webp',
    })

    expect(imageProcessService.process).toHaveBeenCalledWith(expect.any(Buffer), {
      format: TargetFormatEnum.WEBP,
    })
    expect(s3Service.uploadFile).toHaveBeenCalledWith(
      'game/1/cover/mock-uuid.webp',
      expect.any(Buffer),
      'image/webp',
      {
        game_id: '1',
        uploader_id: '9',
      },
    )
  })

  it('uploadGameImage processes and uploads image', async () => {
    const { service, prismaService, imageProcessService, s3Service } = createService()
    prismaService.game.findUnique.mockResolvedValueOnce({ id: 2 })
    imageProcessService.process.mockResolvedValueOnce(processResult)

    await expect(service.uploadGameImage(2, makeFile(), reqUser as any)).resolves.toEqual({
      key: 'game/2/image/mock-uuid.webp',
    })
    expect(s3Service.uploadFile).toHaveBeenCalledWith(
      'game/2/image/mock-uuid.webp',
      expect.any(Buffer),
      'image/webp',
      {
        game_id: '2',
        uploader_id: '9',
      },
    )
  })

  it('uploadGameImage validates game existence, file presence and user size limit', async () => {
    const { service, prismaService } = createService()

    prismaService.game.findUnique.mockResolvedValueOnce(null)
    await expect(service.uploadGameImage(2, makeFile(), reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prismaService.game.findUnique.mockResolvedValueOnce({ id: 2 })
    await expect(
      service.uploadGameImage(2, undefined as any, reqUser as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED,
    })

    prismaService.game.findUnique.mockResolvedValueOnce({ id: 2 })
    await expect(
      service.uploadGameImage(
        2,
        makeFile(SMALL_FILE_UPLOAD_FILE_SIZE_SOFT_LIMIT + 1),
        reqUser as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT,
    })
  })

  it('uploadDeveloperLogo validates existence and uploads logo', async () => {
    const { service, prismaService, imageProcessService, s3Service } = createService()

    prismaService.gameDeveloper.findUnique.mockResolvedValueOnce(null)
    await expect(service.uploadDeveloperLogo(3, makeFile(), reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DEVELOPER_NOT_FOUND,
    })

    prismaService.gameDeveloper.findUnique.mockResolvedValueOnce({ id: 3 })
    imageProcessService.process.mockResolvedValueOnce(processResult)
    await expect(service.uploadDeveloperLogo(3, makeFile(), reqUser as any)).resolves.toEqual({
      key: 'developer/3/logo/mock-uuid.webp',
    })
    expect(s3Service.uploadFile).toHaveBeenCalledWith(
      'developer/3/logo/mock-uuid.webp',
      expect.any(Buffer),
      'image/webp',
      {
        developer_id: '3',
        uploader_id: '9',
      },
    )
  })

  it('uploadDeveloperLogo validates file presence and user size limit', async () => {
    const { service, prismaService } = createService()
    prismaService.gameDeveloper.findUnique.mockResolvedValue({ id: 3 })

    await expect(
      service.uploadDeveloperLogo(3, undefined as any, reqUser as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED,
    })

    await expect(
      service.uploadDeveloperLogo(
        3,
        makeFile(SMALL_FILE_UPLOAD_FILE_SIZE_SOFT_LIMIT + 1),
        reqUser as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT,
    })
  })

  it('uploadCharacterImage validates existence and allows admin oversized upload', async () => {
    const { service, prismaService, imageProcessService, s3Service } = createService()

    prismaService.gameCharacter.findUnique.mockResolvedValueOnce(null)
    await expect(service.uploadCharacterImage(5, makeFile(), reqUser as any)).rejects.toMatchObject(
      {
        code: ShionBizCode.GAME_CHARACTER_NOT_FOUND,
      },
    )

    prismaService.gameCharacter.findUnique.mockResolvedValueOnce({ id: 5 })
    imageProcessService.process.mockResolvedValueOnce(processResult)
    await expect(
      service.uploadCharacterImage(
        5,
        makeFile(SMALL_FILE_UPLOAD_FILE_SIZE_SOFT_LIMIT + 1024),
        reqAdmin as any,
      ),
    ).resolves.toEqual({
      key: 'character/5/image/mock-uuid.webp',
    })
    expect(s3Service.uploadFile).toHaveBeenCalledWith(
      'character/5/image/mock-uuid.webp',
      expect.any(Buffer),
      'image/webp',
      {
        character_id: '5',
        uploader_id: '1',
      },
    )
  })

  it('uploadCharacterImage validates file presence and user size limit', async () => {
    const { service, prismaService } = createService()
    prismaService.gameCharacter.findUnique.mockResolvedValue({ id: 5 })

    await expect(
      service.uploadCharacterImage(5, undefined as any, reqUser as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED,
    })

    await expect(
      service.uploadCharacterImage(
        5,
        makeFile(SMALL_FILE_UPLOAD_FILE_SIZE_SOFT_LIMIT + 1),
        reqUser as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT,
    })
  })

  it('_upload logs and rethrows s3 upload errors', async () => {
    const { service, s3Service } = createService()
    const uploadError = new Error('s3-failed')
    s3Service.uploadFile.mockRejectedValueOnce(uploadError)
    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})

    await expect(
      (service as any)._upload(processResult, 'x/y/z.webp', { any: 'meta' }),
    ).rejects.toBe(uploadError)
    expect(loggerErrorSpy).toHaveBeenCalledWith(uploadError)

    loggerErrorSpy.mockRestore()
  })

  it('url helper upload methods fetch and upload with target metadata', async () => {
    const { service, imageProcessService, s3Service } = createService()

    const cases = [
      {
        method: '_uploadGameCover',
        id: 11,
        key: 'game/11/cover/mock-uuid.webp',
        metadata: { game_id: '11' },
      },
      {
        method: '_uploadGameImage',
        id: 12,
        key: 'game/12/image/mock-uuid.webp',
        metadata: { game_id: '12' },
      },
      {
        method: '_uploadGameCharacterImage',
        id: 13,
        key: 'character/13/image/mock-uuid.webp',
        metadata: { character_id: '13' },
      },
      {
        method: '_uploadGameCharacterRelationImage',
        id: 14,
        key: 'character/14/image/mock-uuid.webp',
        metadata: { character_id: '14' },
      },
      {
        method: '_uploadGameDeveloperImage',
        id: 15,
        key: 'developer/15/image/mock-uuid.webp',
        metadata: { developer_id: '15' },
      },
    ]

    for (const item of cases) {
      imageProcessService.process.mockResolvedValueOnce(processResult)
      await expect(
        (service as any)[item.method](item.id, 'https://example.com/image'),
      ).resolves.toEqual({
        key: item.key,
      })
      expect(imageProcessService.process).toHaveBeenCalledWith(expect.any(Buffer), {
        format: TargetFormatEnum.WEBP,
      })
      expect(s3Service.uploadFile).toHaveBeenLastCalledWith(
        item.key,
        expect.any(Buffer),
        'image/webp',
        item.metadata,
      )
    }

    expect((global as any).fetch).toHaveBeenCalledTimes(5)
  })

  it('_uploadUserAvatar resizes and uploads avatar', async () => {
    const { service, imageProcessService, s3Service } = createService()
    imageProcessService.process.mockResolvedValueOnce(processResult)

    await expect((service as any)._uploadUserAvatar(16, makeFile())).resolves.toEqual({
      key: 'user/16/avatar/mock-uuid.webp',
    })
    expect(imageProcessService.process).toHaveBeenCalledWith(expect.any(Buffer), {
      format: TargetFormatEnum.WEBP,
      maxWidth: 233,
      maxHeight: 233,
    })
    expect(s3Service.uploadFile).toHaveBeenCalledWith(
      'user/16/avatar/mock-uuid.webp',
      expect.any(Buffer),
      'image/webp',
      {
        user_id: '16',
      },
    )
  })
})
