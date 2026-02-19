import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { LargeFileUploadService } from './large-file-upload.service'

describe('LargeFileUploadService', () => {
  const tempDirs: string[] = []
  let consoleErrorSpy: jest.SpyInstance

  const createService = () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shionlib-upload-'))
    tempDirs.push(rootDir)

    const prismaService = {
      gameUploadSession: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    }

    const configValues = new Map<string, any>([
      ['file_upload.upload_root_dir', rootDir],
      ['file_upload.upload_temp_file_suffix', '.upload'],
      ['file_upload.chunk_size', 4],
      ['file_upload.upload_large_file_max_chunks', 5],
      ['file_upload.upload_large_file_max_size', 10],
      ['file_upload.upload_session_expires_in', 60_000],
    ])
    const configService = {
      get: jest.fn((key: string) => configValues.get(key)),
    }

    const uploadQuotaService = {
      isExceeded: jest.fn(),
      adjustUploadQuotaUsedAmount: jest.fn(),
      withdrawUploadQuotaUseAdjustment: jest.fn(),
    }

    const hashWorkerService = {
      calculateHash: jest.fn(),
    }

    const service = new LargeFileUploadService(
      prismaService as any,
      configService as any,
      uploadQuotaService as any,
      hashWorkerService as any,
    )

    return {
      rootDir,
      prismaService,
      configService,
      uploadQuotaService,
      hashWorkerService,
      service,
    }
  }

  const reqUser = { user: { sub: 9, role: ShionlibUserRoles.USER } }
  const reqAdmin = { user: { sub: 1, role: ShionlibUserRoles.ADMIN } }

  const makeSession = (overrides: Partial<any> = {}) => ({
    id: 11,
    file_name: 'game.7z',
    total_size: 10n,
    chunk_size: 4,
    total_chunks: 3,
    uploaded_chunks: [] as number[],
    hash_algorithm: 'blake3',
    file_sha256: 'file-hash',
    status: 'UPLOADING',
    storage_path: '/tmp/session.upload',
    expires_at: new Date(Date.now() + 60_000),
    creator_id: 9,
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('init validates quota, chunk count and upload size limit', async () => {
    const { service, uploadQuotaService } = createService()

    uploadQuotaService.isExceeded.mockResolvedValueOnce(true)
    await expect(
      service.init({ file_name: 'a.7z', total_size: 8, file_sha256: 'h1' } as any, reqUser as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.USER_UPLOAD_QUOTA_EXCEEDED,
    })

    uploadQuotaService.isExceeded.mockResolvedValueOnce(false)
    await expect(
      service.init(
        { file_name: 'b.7z', total_size: 0, file_sha256: 'h2', chunk_size: 4 } as any,
        reqUser as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_TOTAL_SIZE,
    })

    uploadQuotaService.isExceeded.mockResolvedValueOnce(false)
    await expect(
      service.init(
        { file_name: 'c.7z', total_size: 6, file_sha256: 'h3', chunk_size: 1 } as any,
        reqUser as any,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_TOO_MANY_CHUNKS,
    })

    uploadQuotaService.isExceeded.mockResolvedValueOnce(false)
    await expect(
      service.init({ file_name: 'd.7z', total_size: 12, file_sha256: 'h4' } as any, reqUser as any),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_TOO_LARGE,
    })
  })

  it('init creates session and preallocates temp file, then adjusts quota', async () => {
    const { service, rootDir, prismaService, uploadQuotaService } = createService()

    uploadQuotaService.isExceeded.mockResolvedValueOnce(false)
    prismaService.gameUploadSession.create.mockResolvedValueOnce({
      id: 99,
      expires_at: new Date('2026-02-18T00:00:00.000Z'),
    })
    prismaService.gameUploadSession.update.mockResolvedValueOnce({})

    await expect(
      service.init(
        { file_name: 'game.7z', total_size: 10, file_sha256: 'f-hash', chunk_size: 4 } as any,
        reqUser as any,
      ),
    ).resolves.toEqual({
      upload_session_id: 99,
      chunk_size: 4,
      total_chunks: 3,
      expires_at: new Date('2026-02-18T00:00:00.000Z'),
    })

    const pendingPath = path.join(rootDir, 'PENDING.upload')
    const sessionPath = path.join(rootDir, '99.upload')
    expect(prismaService.gameUploadSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storage_path: pendingPath,
          creator_id: 9,
          total_size: 10,
          total_chunks: 3,
        }),
      }),
    )
    expect(prismaService.gameUploadSession.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { storage_path: sessionPath },
    })
    expect(fs.statSync(sessionPath).size).toBe(10)
    expect(uploadQuotaService.adjustUploadQuotaUsedAmount).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        action: 'USE',
        amount: 10,
        upload_session_id: 99,
      }),
    )
  })

  it('init allows admin uploads beyond large file limit', async () => {
    const { service, prismaService, uploadQuotaService } = createService()

    uploadQuotaService.isExceeded.mockResolvedValueOnce(false)
    prismaService.gameUploadSession.create.mockResolvedValueOnce({
      id: 12,
      expires_at: new Date('2026-02-18T00:00:00.000Z'),
    })
    prismaService.gameUploadSession.update.mockResolvedValueOnce({})

    await service.init(
      { file_name: 'big.7z', total_size: 12, file_sha256: 'hash', chunk_size: 4 } as any,
      reqAdmin as any,
    )

    expect(prismaService.gameUploadSession.create).toHaveBeenCalled()
  })

  it('init logs and rethrows internal errors', async () => {
    const { service, prismaService, uploadQuotaService } = createService()
    const error = new Error('mkdir failed')
    const mkdirSpy = jest.spyOn(fs.promises, 'mkdir').mockRejectedValueOnce(error as any)

    uploadQuotaService.isExceeded.mockResolvedValueOnce(false)
    prismaService.gameUploadSession.create.mockResolvedValueOnce({
      id: 1,
      expires_at: new Date('2026-02-18T00:00:00.000Z'),
    })
    prismaService.gameUploadSession.update.mockResolvedValueOnce({})

    await expect(
      service.init(
        { file_name: 'err.7z', total_size: 8, file_sha256: 'hash', chunk_size: 4 } as any,
        reqUser as any,
      ),
    ).rejects.toBe(error)
    expect(consoleErrorSpy).toHaveBeenCalledWith(error)

    mkdirSpy.mockRestore()
  })

  it('writeChunk validates session existence, status, index, expiry, owner and length', async () => {
    const { service, prismaService } = createService()

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(null)
    await expect(service.writeChunk(1, 0, 's', reqUser as any, 4)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ status: 'ABORTED' }),
    )
    await expect(service.writeChunk(1, 0, 's', reqUser as any, 4)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(makeSession())
    await expect(service.writeChunk(1, -1, 's', reqUser as any, 4)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_CHUNK_INDEX,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ expires_at: new Date(Date.now() - 1000) }),
    )
    await expect(service.writeChunk(1, 0, 's', reqUser as any, 4)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_EXPIRED,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ creator_id: 100 }),
    )
    await expect(service.writeChunk(1, 0, 's', reqUser as any, 4)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(makeSession())
    await expect(service.writeChunk(1, 0, 's', reqUser as any, 3)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_UNEXPECTED_CONTENT_LENGTH,
    })
  })

  it('writeChunk writes new chunk and records uploaded index', async () => {
    const { service, rootDir, prismaService, hashWorkerService } = createService()
    const storagePath = path.join(rootDir, '11.upload')
    fs.writeFileSync(storagePath, Buffer.alloc(10))

    const body = Buffer.from('ABCD')
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ storage_path: storagePath }),
    )
    hashWorkerService.calculateHash.mockResolvedValueOnce('ok-sha')

    await expect(
      service.writeChunk(11, 0, 'ok-sha', { ...reqUser, body } as any, 4),
    ).resolves.toEqual({
      ok: true,
      chunk_index: 0,
    })

    expect(hashWorkerService.calculateHash).toHaveBeenCalledWith({
      algorithm: 'sha256',
      data: body,
    })
    expect(prismaService.gameUploadSession.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { uploaded_chunks: { push: 0 } },
    })
    const content = fs.readFileSync(storagePath).subarray(0, 4)
    expect(content.equals(body)).toBe(true)
  })

  it('writeChunk rejects when new chunk hash mismatches', async () => {
    const { service, rootDir, prismaService, hashWorkerService } = createService()
    const storagePath = path.join(rootDir, '11.upload')
    fs.writeFileSync(storagePath, Buffer.alloc(10))

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ storage_path: storagePath }),
    )
    hashWorkerService.calculateHash.mockResolvedValueOnce('actual-sha')

    await expect(
      service.writeChunk(
        11,
        0,
        'expected-sha',
        { ...reqUser, body: Buffer.from('ABCD') } as any,
        4,
      ),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_CHUNK_SHA256_MISMATCH,
    })
    expect(prismaService.gameUploadSession.update).not.toHaveBeenCalled()
  })

  it('writeChunk validates already-uploaded chunk by reading file and comparing hash', async () => {
    const { service, rootDir, prismaService, hashWorkerService } = createService()
    const storagePath = path.join(rootDir, '11.upload')
    fs.writeFileSync(storagePath, Buffer.from('ABCDEFGHxx'))

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ storage_path: storagePath, uploaded_chunks: [1] }),
    )
    hashWorkerService.calculateHash.mockResolvedValueOnce('mismatch')
    await expect(service.writeChunk(11, 1, 'expected', reqUser as any, 4)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_CHUNK_SHA256,
    })

    hashWorkerService.calculateHash.mockResolvedValueOnce('matched')
    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ storage_path: storagePath, uploaded_chunks: [1] }),
    )
    await expect(service.writeChunk(11, 1, 'matched', reqUser as any, 4)).resolves.toEqual({
      ok: true,
      chunk_index: 1,
    })
    expect(prismaService.gameUploadSession.update).not.toHaveBeenCalled()
  })

  it('status validates session and returns sorted chunk status payload', async () => {
    const { service, prismaService } = createService()

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(null)
    await expect(service.status(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ expires_at: new Date(Date.now() - 1) }),
    )
    await expect(service.status(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_EXPIRED,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ creator_id: 999 }),
    )
    await expect(service.status(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ uploaded_chunks: [2, 0, 1] }),
    )
    await expect(service.status(1, reqUser as any)).resolves.toEqual(
      expect.objectContaining({
        status: 'UPLOADING',
        uploaded_chunks: [0, 1, 2],
        total_size: 10,
        chunk_size: 4,
        total_chunks: 3,
      }),
    )
  })

  it('complete validates session state and final file hash', async () => {
    const { service, prismaService, hashWorkerService } = createService()

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(null)
    await expect(service.complete(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ status: 'ABORTED' }),
    )
    await expect(service.complete(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ uploaded_chunks: [0, 1] }),
    )
    await expect(service.complete(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INCOMPLETE,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ uploaded_chunks: [0, 1, 2], expires_at: new Date(Date.now() - 1) }),
    )
    await expect(service.complete(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_EXPIRED,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ uploaded_chunks: [0, 1, 2], creator_id: 99 }),
    )
    await expect(service.complete(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ uploaded_chunks: [0, 1, 2] }),
    )
    hashWorkerService.calculateHash.mockResolvedValueOnce('not-match')
    await expect(service.complete(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_FILE_BLAKE3_MISMATCH,
    })
  })

  it('complete marks session as COMPLETED when file hash is valid', async () => {
    const { service, prismaService, hashWorkerService } = createService()
    const storagePath = '/tmp/file.7z'

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({
        uploaded_chunks: [0, 1, 2],
        storage_path: storagePath,
        file_sha256: 'same',
      }),
    )
    hashWorkerService.calculateHash.mockResolvedValueOnce('same')

    await expect(service.complete(1, reqUser as any)).resolves.toEqual({
      ok: true,
      path: storagePath,
    })
    expect(prismaService.gameUploadSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 11 },
        data: expect.objectContaining({
          status: 'COMPLETED',
          mime_type: expect.any(String),
        }),
      }),
    )
  })

  it('abort validates session and handles success path', async () => {
    const { service, rootDir, prismaService, uploadQuotaService } = createService()
    const storagePath = path.join(rootDir, '11.upload')
    fs.writeFileSync(storagePath, Buffer.from('x'))

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(null)
    await expect(service.abort(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_FOUND,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ status: 'COMPLETED' }),
    )
    await expect(service.abort(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_INVALID_SESSION_STATUS,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ expires_at: new Date(Date.now() - 1) }),
    )
    await expect(service.abort(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_EXPIRED,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ creator_id: 999 }),
    )
    await expect(service.abort(1, reqUser as any)).rejects.toMatchObject({
      code: ShionBizCode.GAME_UPLOAD_SESSION_NOT_OWNER,
    })

    prismaService.gameUploadSession.findUnique.mockResolvedValueOnce(
      makeSession({ storage_path: storagePath }),
    )
    prismaService.gameUploadSession.update.mockResolvedValueOnce({})

    await expect(service.abort(1, reqUser as any)).resolves.toBeUndefined()
    expect(prismaService.gameUploadSession.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { status: 'ABORTED' },
    })
    expect(uploadQuotaService.withdrawUploadQuotaUseAdjustment).toHaveBeenCalledWith(9, 11)
    expect(fs.existsSync(storagePath)).toBe(false)
  })

  it('abort logs and rethrows internal errors', async () => {
    const { service, prismaService } = createService()
    const error = new Error('db fail')

    prismaService.gameUploadSession.findUnique.mockRejectedValueOnce(error)

    await expect(service.abort(1, reqUser as any)).rejects.toBe(error)
    expect(consoleErrorSpy).toHaveBeenCalledWith(error)
  })

  it('getOngoingSessions maps bigint size to number', async () => {
    const { service, prismaService } = createService()
    const expiresAt = new Date('2026-02-18T00:00:00.000Z')
    prismaService.gameUploadSession.findMany.mockResolvedValueOnce([
      {
        id: 20,
        file_name: 'a.7z',
        file_sha256: 'h1',
        total_size: 123n,
        uploaded_chunks: [0, 1],
        total_chunks: 3,
        expires_at: expiresAt,
      },
    ])

    await expect(service.getOngoingSessions(reqUser as any)).resolves.toEqual([
      {
        upload_session_id: 20,
        file_name: 'a.7z',
        file_sha256: 'h1',
        total_size: 123,
        uploaded_chunks: [0, 1],
        total_chunks: 3,
        expires_at: expiresAt,
      },
    ])
    expect(prismaService.gameUploadSession.findMany).toHaveBeenCalledWith({
      where: { creator_id: 9, status: 'UPLOADING' },
      select: {
        id: true,
        file_name: true,
        file_sha256: true,
        total_size: true,
        uploaded_chunks: true,
        total_chunks: true,
        expires_at: true,
      },
    })
  })
})
