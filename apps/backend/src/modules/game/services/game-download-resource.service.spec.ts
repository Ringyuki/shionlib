import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { ActivityFileStatus } from '../../activity/dto/create-activity.dto'
import { of } from 'rxjs'
import { GameDownloadSourceService } from './game-download-resource.service'

describe('GameDownloadSourceService', () => {
  const createService = () => {
    const prismaService = {
      game: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      gameUploadSession: {
        findUnique: jest.fn(),
      },
      gameDownloadResource: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      gameDownloadResourceFile: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      gameDownloadResourceFileHistory: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      favoriteItem: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    }

    const s3Service = {
      deleteFile: jest.fn(),
    }

    const b2Service = {
      getDownloadUrl: jest.fn(),
    }

    const configValues = new Map<string, any>([
      ['cloudflare.turnstile.secret', 'turnstile-secret'],
      ['file_download.download_expires_in', 1800],
    ])
    const configService = {
      get: jest.fn((key: string) => configValues.get(key)),
    }

    const activityService = {
      create: jest.fn(),
    }

    const httpService = {
      post: jest.fn(),
    }

    const uploadQuotaService = {
      withdrawUploadQuotaUseAdjustment: jest.fn(),
    }

    const messageService = {
      send: jest.fn(),
    }

    const service = new GameDownloadSourceService(
      prismaService as any,
      s3Service as any,
      b2Service as any,
      configService as any,
      activityService as any,
      httpService as any,
      uploadQuotaService as any,
      messageService as any,
    )

    return {
      prismaService,
      s3Service,
      b2Service,
      configService,
      activityService,
      httpService,
      uploadQuotaService,
      messageService,
      service,
    }
  }

  const ownerReq = { user: { sub: 100, role: ShionlibUserRoles.USER } }
  const otherUserReq = { user: { sub: 200, role: ShionlibUserRoles.USER } }
  const adminReq = { user: { sub: 300, role: ShionlibUserRoles.ADMIN } }

  const makeUploadedFile = () => ({
    id: 10,
    creator_id: 100,
    file_name: 'file.7z',
    file_status: ActivityFileStatus.UPLOADED_TO_S3,
    file_size: 1024,
    upload_session_id: 111,
    s3_file_key: 's3/key',
    game_download_resource_id: 20,
    game_download_resource: {
      id: 20,
      game_id: 30,
      creator_id: 100,
      status: 1,
      game: {
        id: 30,
        title_jp: 'jp',
        title_zh: 'zh',
        title_en: 'en',
      },
    },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getByGameId throws when game does not exist', async () => {
    const { service, prismaService } = createService()
    prismaService.game.findUnique.mockResolvedValue(null)

    await expect(service.getByGameId(404, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
  })

  it('getByGameId maps file_size and filters by visibility/owner', async () => {
    const { service, prismaService } = createService()
    prismaService.game.findUnique.mockResolvedValue({
      id: 1,
      download_resources: [
        {
          id: 11,
          files: [
            { id: 1, file_size: 1n, file_status: 3, creator: { id: 9 } },
            { id: 2, file_size: 2n, file_status: 2, creator: { id: 100 } },
            { id: 3, file_size: 3n, file_status: 2, creator: { id: 999 } },
          ],
        },
        {
          id: 12,
          files: [{ id: 4, file_size: 4n, file_status: 2, creator: { id: 999 } }],
        },
      ],
    })

    const result = await service.getByGameId(1, ownerReq as any)

    expect(result).toHaveLength(1)
    expect(result[0].files).toHaveLength(2)
    expect(result[0].files[0].file_size).toBe(1)
    expect(result[0].files[1].file_size).toBe(2)
  })

  it('create validates game/session/ownership and duplicate upload session', async () => {
    const { service, prismaService } = createService()
    const dto = {
      upload_session_id: 99,
      file_name: 'x.7z',
      platform: ['win'],
      language: ['jp'],
      note: 'n',
    }

    await expect(service.create(dto as any, Number.NaN, 1)).rejects.toMatchObject({
      code: ShionBizCode.COMMON_VALIDATION_FAILED,
    })

    prismaService.game.findUnique.mockResolvedValueOnce(null)
    await expect(service.create(dto as any, 1, 1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prismaService.game.findUnique.mockResolvedValueOnce({ id: 1 })
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(null)
    await expect(service.create(dto as any, 1, 1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
    })

    prismaService.game.findUnique.mockResolvedValueOnce({ id: 1 })
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce({
      id: 99,
      status: 'PENDING',
      creator_id: 1,
    })
    await expect(service.create(dto as any, 1, 1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
    })

    prismaService.game.findUnique.mockResolvedValueOnce({ id: 1 })
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce({
      id: 99,
      status: 'COMPLETED',
      creator_id: 2,
    })
    await expect(service.create(dto as any, 1, 1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
    })

    prismaService.game.findUnique.mockResolvedValueOnce({ id: 1 })
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce({
      id: 99,
      status: 'COMPLETED',
      creator_id: 1,
    })
    prismaService.gameDownloadResource.findFirst.mockResolvedValueOnce({ id: 100 })
    await expect(service.create(dto as any, 1, 1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_UPLOAD_SESSION_ALREADY_USED,
    })
  })

  it('create writes resource/file and creates activity in transaction', async () => {
    const { service, prismaService, activityService } = createService()
    const session = {
      id: 99,
      status: 'COMPLETED',
      creator_id: 100,
      file_name: 'origin.7z',
      storage_path: '/tmp/origin.7z',
      total_size: 2048,
      hash_algorithm: 'blake3',
      file_sha256: 'hash',
      mime_type: 'application/x-7z-compressed',
    }
    const tx = {
      gameDownloadResource: { create: jest.fn().mockResolvedValue({ id: 501 }) },
      gameDownloadResourceFile: { create: jest.fn().mockResolvedValue({ id: 601 }) },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))
    prismaService.game.findUnique.mockResolvedValue({ id: 1 })
    prismaService.gameUploadSession.findUnique.mockResolvedValue(session)
    prismaService.gameDownloadResource.findFirst.mockResolvedValue(null)

    await service.create(
      {
        upload_session_id: 99,
        file_name: '',
        platform: ['win'],
        language: ['jp'],
        note: 'note',
      } as any,
      1,
      100,
    )

    expect(tx.gameDownloadResource.create).toHaveBeenCalled()
    expect(tx.gameDownloadResourceFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          game_download_resource_id: 501,
          file_name: 'origin.7z',
          file_path: '/tmp/origin.7z',
        }),
      }),
    )
    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 100,
        game_id: 1,
        file_id: 601,
      }),
      tx,
    )
  })

  it('edit validates existence/ownership and updates fields', async () => {
    const { service, prismaService } = createService()
    prismaService.gameDownloadResource.findUnique.mockResolvedValueOnce(null)

    await expect(service.edit(1, {} as any, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_FOUND,
    })

    prismaService.gameDownloadResource.findUnique.mockResolvedValueOnce({ id: 1, creator_id: 999 })
    await expect(service.edit(1, {} as any, otherUserReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_OWNER,
    })

    const tx = {
      gameDownloadResource: {
        findUnique: jest.fn().mockResolvedValue({ updated: new Date('2026-02-18T00:00:00.000Z') }),
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))
    prismaService.gameDownloadResource.findUnique.mockResolvedValueOnce({ id: 1, creator_id: 100 })

    await service.edit(
      1,
      { platform: ['win'], language: ['jp'], note: 'n', file_name: 'new.7z' } as any,
      ownerReq as any,
    )

    expect(tx.gameDownloadResource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          note: 'n',
          files: {
            updateMany: {
              where: { game_download_resource_id: 1 },
              data: { file_name: 'new.7z' },
            },
          },
        }),
      }),
    )
  })

  it('delete supports authorization, soft delete and hard delete', async () => {
    const { service, prismaService, s3Service } = createService()
    prismaService.gameDownloadResource.findUnique.mockResolvedValueOnce(null)

    await expect(service.delete(1, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_FOUND,
    })

    prismaService.gameDownloadResource.findUnique.mockResolvedValueOnce({ id: 2, creator_id: 999 })
    await expect(service.delete(2, otherUserReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_OWNER,
    })

    prismaService.gameDownloadResource.findUnique.mockResolvedValueOnce({ id: 3, creator_id: 100 })
    prismaService.gameDownloadResourceFile.findMany.mockResolvedValueOnce([
      { s3_file_key: 'file/a' },
      { s3_file_key: null },
    ])
    await service.delete(3, ownerReq as any, true)
    expect(s3Service.deleteFile).toHaveBeenCalledWith('file/a')
    expect(prismaService.gameDownloadResource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({ status: 2 }),
      }),
    )

    prismaService.gameDownloadResource.findUnique.mockResolvedValueOnce({ id: 4, creator_id: 999 })
    prismaService.gameDownloadResourceFile.findMany.mockResolvedValueOnce([])
    await service.delete(4, adminReq as any, false)
    expect(prismaService.gameDownloadResource.delete).toHaveBeenCalledWith({ where: { id: 4 } })
  })

  it('getDownloadLink validates token and file existence', async () => {
    const { service, prismaService } = createService()

    await expect(service.getDownloadLink(1, '')).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_TOKEN_REQUIRED,
    })

    jest
      .spyOn(service as any, 'validateToken')
      .mockResolvedValueOnce({ success: false, error_codes: ['bad-token'] })
    await expect(service.getDownloadLink(1, 'bad')).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_INVALID_TOKEN,
    })

    jest
      .spyOn(service as any, 'validateToken')
      .mockResolvedValueOnce({ success: true, error_codes: [] })
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce(null)
    await expect(service.getDownloadLink(1, 'ok')).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND,
    })
  })

  it('validateToken posts to cloudflare turnstile and maps response', async () => {
    const { service, httpService } = createService()
    httpService.post.mockReturnValue(
      of({
        data: {
          success: true,
          'error-codes': ['ok'],
        },
      }),
    )

    const result = await (service as any).validateToken('token-123')
    expect(httpService.post).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        response: 'token-123',
        secret: 'turnstile-secret',
      },
    )
    expect(result).toEqual({ success: true, error_codes: ['ok'] })
  })

  it('getDownloadLink increments counters and returns b2 url with long expiry for large files', async () => {
    const { service, prismaService, b2Service } = createService()
    jest
      .spyOn(service as any, 'validateToken')
      .mockResolvedValueOnce({ success: true, error_codes: [] })
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue({
      game_download_resource_id: 20,
      s3_file_key: 's3/large.file',
      file_size: 25 * 1024 * 1024 * 1024,
    })
    const tx = {
      gameDownloadResource: {
        findUnique: jest.fn().mockResolvedValue({ updated: new Date('2026-02-18T00:00:00.000Z') }),
        update: jest.fn().mockResolvedValue({ game_id: 30 }),
      },
      game: {
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))
    b2Service.getDownloadUrl.mockResolvedValue('https://b2/download')

    const result = await service.getDownloadLink(1, 'ok-token')
    expect(result).toEqual({
      file_url: 'https://b2/download',
      expires_in: 6 * 60 * 60,
    })
    expect(tx.gameDownloadResource.update).toHaveBeenCalled()
    expect(tx.game.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { downloads: { increment: 1 } },
    })
    expect(b2Service.getDownloadUrl).toHaveBeenCalledWith('s3/large.file', 6 * 60 * 60)
  })

  it('getDownloadLink keeps default expiry for small files', async () => {
    const { service, prismaService, b2Service } = createService()
    jest
      .spyOn(service as any, 'validateToken')
      .mockResolvedValueOnce({ success: true, error_codes: [] })
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue({
      game_download_resource_id: 21,
      s3_file_key: 's3/small.file',
      file_size: 2 * 1024 * 1024 * 1024,
    })
    const tx = {
      gameDownloadResource: {
        findUnique: jest.fn().mockResolvedValue({ updated: new Date('2026-02-18T00:00:00.000Z') }),
        update: jest.fn().mockResolvedValue({ game_id: 31 }),
      },
      game: {
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))
    b2Service.getDownloadUrl.mockResolvedValue('https://b2/small')

    const result = await service.getDownloadLink(2, 'ok-token')
    expect(result).toEqual({
      file_url: 'https://b2/small',
      expires_in: 1800,
    })
    expect(b2Service.getDownloadUrl).toHaveBeenCalledWith('s3/small.file', 1800)
  })

  it('getList maps resources to paginated response', async () => {
    const { service, prismaService } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z')
    prismaService.gameDownloadResource.count.mockResolvedValue(3)
    prismaService.gameDownloadResource.findMany.mockResolvedValue([
      {
        id: 1,
        platform: ['win'],
        language: ['jp'],
        note: 'n',
        downloads: 9,
        game: { id: 2, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
        _count: { files: 2 },
        files: [{ file_name: 'a.7z' }, { file_name: 'b.7z' }],
        creator: { id: 100, name: 'alice', avatar: null },
        created: now,
      },
    ])

    const result = await service.getList({ page: 1, pageSize: 10 } as any)
    expect(result.items[0]).toEqual({
      id: 1,
      platform: ['win'],
      language: ['jp'],
      note: 'n',
      downloads: 9,
      game: { id: 2, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
      files: ['a.7z', 'b.7z'],
      files_count: 2,
      creator: { id: 100, name: 'alice', avatar: null },
      created: now,
    })
    expect(result.meta.totalItems).toBe(3)
  })

  it('migrateCreate validates game and returns created resource id', async () => {
    const { service, prismaService } = createService()
    const tx = {
      game: { findUnique: jest.fn() },
      gameDownloadResource: { create: jest.fn() },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))

    tx.game.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.migrateCreate({ platform: ['win'], language: ['jp'] } as any, 9),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    tx.game.findUnique.mockResolvedValueOnce({ id: 9 })
    tx.gameDownloadResource.create.mockResolvedValueOnce({ id: 77 })
    await expect(
      service.migrateCreate({ platform: ['win'], language: ['jp'] } as any, 9),
    ).resolves.toBe(77)
  })

  it('migrateCreateFile creates file record in transaction', async () => {
    const { service, prismaService } = createService()
    const tx = {
      gameDownloadResourceFile: { create: jest.fn() },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))

    await service.migrateCreateFile(
      {
        file_name: 'file.7z',
        file_size: 1234,
        file_hash: 'hash',
        file_content_type: 'application/x-7z-compressed',
        s3_file_key: 'key/a',
      } as any,
      1,
    )

    expect(tx.gameDownloadResourceFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          game_download_resource_id: 1,
          file_name: 'file.7z',
          file_status: 3,
        }),
      }),
    )
  })

  it('reuploadFile validates file/session constraints before transaction', async () => {
    const { service, prismaService } = createService()
    const dto = { upload_session_id: 555, reason: 'fix hash' }

    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce(null)
    await expect(service.reuploadFile(1, dto as any, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND,
    })

    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce({
      ...makeUploadedFile(),
      file_status: ActivityFileStatus.UPLOADED_TO_SERVER,
    })
    await expect(service.reuploadFile(1, dto as any, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_FILE_STATUS,
    })

    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce({
      ...makeUploadedFile(),
      creator_id: 999,
    })
    await expect(service.reuploadFile(1, dto as any, otherUserReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_NOT_OWNER,
    })

    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce(makeUploadedFile())
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(null)
    await expect(service.reuploadFile(1, dto as any, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
    })

    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce(makeUploadedFile())
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce({
      id: 555,
      status: 'PENDING',
      creator_id: 100,
    })
    await expect(service.reuploadFile(1, dto as any, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
    })

    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce(makeUploadedFile())
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce({
      id: 555,
      status: 'COMPLETED',
      creator_id: 999,
    })
    await expect(service.reuploadFile(1, dto as any, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
    })

    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce(makeUploadedFile())
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce({
      id: 555,
      status: 'COMPLETED',
      creator_id: 100,
    })
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce({ id: 2 })
    await expect(service.reuploadFile(1, dto as any, ownerReq as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_ALREADY_USED,
    })
  })

  it('reuploadFile success path updates history, replaces file and notifies followers', async () => {
    const { service, prismaService, s3Service, uploadQuotaService, activityService } =
      createService()
    const dto = { upload_session_id: 556, reason: 'new package' }
    const file = makeUploadedFile()
    const session = {
      id: 556,
      status: 'COMPLETED',
      creator_id: 100,
      total_size: 3333,
      hash_algorithm: 'blake3',
      file_sha256: 'new-hash',
      storage_path: '/tmp/new.7z',
      mime_type: 'application/x-7z-compressed',
    }
    prismaService.gameDownloadResourceFile.findUnique
      .mockResolvedValueOnce(file)
      .mockResolvedValueOnce(null)
    prismaService.gameUploadSession.findUnique.mockResolvedValue(session)
    const tx = {
      gameDownloadResourceFileHistory: {
        create: jest.fn(),
      },
      gameDownloadResource: {
        update: jest.fn(),
      },
      gameDownloadResourceFile: {
        update: jest.fn(),
      },
    }
    prismaService.$transaction.mockImplementation(async (cb: any) => cb(tx))
    const notifySpy = jest.spyOn(service as any, 'notifyFavoriteUsers').mockResolvedValue(undefined)

    await expect(service.reuploadFile(10, dto as any, ownerReq as any)).resolves.toEqual({
      ok: true,
    })

    expect(tx.gameDownloadResourceFileHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          file_id: 10,
          upload_session_id: 556,
          operator_id: 100,
          reason: 'new package',
        }),
      }),
    )
    expect(s3Service.deleteFile).toHaveBeenCalledWith('s3/key', true)
    expect(uploadQuotaService.withdrawUploadQuotaUseAdjustment).toHaveBeenCalledWith(100, 111)
    expect(tx.gameDownloadResourceFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          file_path: '/tmp/new.7z',
          file_size: 3333,
          file_hash: 'new-hash',
          file_status: 2,
          file_check_status: 0,
          s3_file_key: null,
          upload_session_id: 556,
        }),
      }),
    )
    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FILE_REUPLOAD',
        file_id: 10,
        game_id: 30,
      }),
      tx,
    )
    expect(notifySpy).toHaveBeenCalledWith(
      30,
      file.game_download_resource.game,
      'file.7z',
      'new package',
      100,
      tx,
    )
  })

  it('getFileHistory validates file and maps bigint size', async () => {
    const { service, prismaService } = createService()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce(null)
    await expect(service.getFileHistory(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND,
    })

    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValueOnce({
      id: 1,
      creator_id: 100,
      game_download_resource: { creator_id: 100 },
    })
    prismaService.gameDownloadResourceFileHistory.findMany.mockResolvedValueOnce([
      {
        id: 1,
        file_size: 999n,
        hash_algorithm: 'blake3',
        file_hash: 'h',
        s3_file_key: null,
        reason: 'r',
        operator: { id: 100, name: 'alice', avatar: null },
        created: new Date('2026-02-18T00:00:00.000Z'),
      },
    ])

    const result = await service.getFileHistory(1)
    expect(result[0].file_size).toBe(999)
  })

  it('notifyFavoriteUsers sends system message to each non-operator favorite user', async () => {
    const { service, prismaService, messageService } = createService()
    prismaService.favoriteItem.findMany.mockResolvedValue([
      { favorite: { user_id: 2 } },
      { favorite: { user_id: 3 } },
    ])

    await (service as any).notifyFavoriteUsers(
      30,
      { id: 30, title_jp: 'jp', title_zh: 'zh', title_en: 'en' },
      'file.7z',
      'fix hash',
      1,
    )

    expect(messageService.send).toHaveBeenCalledTimes(2)
    expect(messageService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        receiver_id: 2,
        game_id: 30,
        meta: expect.objectContaining({ file_name: 'file.7z', reason: 'fix hash' }),
      }),
      undefined,
    )
  })
})
