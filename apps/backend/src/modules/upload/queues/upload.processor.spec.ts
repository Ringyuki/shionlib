jest.mock('fs', () => {
  const actual = jest.requireActual('fs')
  return {
    ...actual,
    existsSync: jest.fn(actual.existsSync),
    createReadStream: jest.fn(actual.createReadStream),
    promises: {
      ...actual.promises,
      rm: jest.fn(actual.promises.rm),
    },
  }
})

import * as fs from 'fs'
import { UploadProcessor } from './upload.processor'
import {
  ActivityFileCheckStatus,
  ActivityFileStatus,
  ActivityType,
} from '../../activity/dto/create-activity.dto'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'

describe('UploadProcessor', () => {
  const makeProcessor = () => {
    const tx = {
      gameDownloadResourceFileHistory: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      },
      gameDownloadResourceFile: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    }
    const prismaService = {
      gameDownloadResourceFile: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (arg: any) => Promise<unknown>) => cb(tx)),
    }
    const s3Service = {
      uploadFileStream: jest.fn().mockResolvedValue(undefined),
    }
    const activityService = {
      create: jest.fn().mockResolvedValue(undefined),
    }
    const messageService = {
      send: jest.fn().mockResolvedValue(undefined),
    }
    const processor = new UploadProcessor(
      prismaService as any,
      s3Service as any,
      activityService as any,
      messageService as any,
    )
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
    ;(processor as any).logger = logger

    return {
      processor,
      tx,
      prismaService,
      s3Service,
      activityService,
      messageService,
      logger,
    }
  }

  const makeFile = (override: Partial<any> = {}) => ({
    id: 11,
    file_name: '../unsafe/my file.zip',
    file_size: 2048,
    file_path: '/tmp/upload.bin',
    file_status: 1,
    file_check_status: 1,
    file_content_type: null,
    s3_file_key: null,
    creator_id: 7,
    file_hash: 'hash-1',
    hash_algorithm: 'sha256',
    upload_session_id: 'session-1',
    game_download_resource: { game_id: 99 },
    ...override,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(fs.existsSync as jest.Mock).mockReturnValue(true)
    ;(fs.createReadStream as jest.Mock).mockReturnValue({ stream: true })
    ;(fs.promises.rm as jest.Mock).mockResolvedValue(undefined)
  })

  it('logs lifecycle callbacks', () => {
    const { processor, logger } = makeProcessor()
    const job = { id: 1, name: 'upload' } as any
    const err = new Error('boom')

    processor.onActive(job)
    processor.onCompleted(job)
    processor.onFailed(job, err)

    expect(logger.log).toHaveBeenCalledWith('Starting job 1(upload)')
    expect(logger.log).toHaveBeenCalledWith('Completed job 1(upload)')
    expect(logger.error).toHaveBeenCalledWith('Failed job 1(upload): boom', err.stack)
  })

  it('skips when resource file does not exist', async () => {
    const { processor, prismaService, logger, s3Service } = makeProcessor()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(null)

    await expect(processor.processS3Upload({ data: { resourceFileId: 12 } } as any)).resolves.toBe(
      undefined,
    )

    expect(logger.warn).toHaveBeenCalledWith('resource file 12 not found, skip')
    expect(s3Service.uploadFileStream).not.toHaveBeenCalled()
  })

  it('skips when file is already uploaded to S3', async () => {
    const { processor, prismaService, logger, s3Service } = makeProcessor()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(
      makeFile({
        file_status: 3,
        s3_file_key: 'games/99/11/my_file.zip',
      }),
    )

    await expect(processor.processS3Upload({ data: { resourceFileId: 11 } } as any)).resolves.toBe(
      undefined,
    )

    expect(logger.log).toHaveBeenCalledWith('resource file 11 already on S3, skip')
    expect(s3Service.uploadFileStream).not.toHaveBeenCalled()
  })

  it('throws when file check status is not OK', async () => {
    const { processor, prismaService } = makeProcessor()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(
      makeFile({
        file_check_status: 2,
      }),
    )

    await expect(
      processor.processS3Upload({ data: { resourceFileId: 11 } } as any),
    ).rejects.toThrow('resource file 11 not OK to upload (status=2)')
  })

  it('throws when local file path is missing', async () => {
    const { processor, prismaService } = makeProcessor()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(makeFile())
    ;(fs.existsSync as jest.Mock).mockReturnValue(false)

    await expect(
      processor.processS3Upload({ data: { resourceFileId: 11 } } as any),
    ).rejects.toThrow('local file not found for resource file 11: /tmp/upload.bin')
  })

  it('uploads to S3, updates latest history, records activity and message', async () => {
    const { processor, prismaService, s3Service, tx, activityService, messageService } =
      makeProcessor()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(makeFile())
    tx.gameDownloadResourceFileHistory.findFirst.mockResolvedValue({ id: 123 })

    await processor.processS3Upload({ data: { resourceFileId: 11 } } as any)

    expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/upload.bin')
    expect(s3Service.uploadFileStream).toHaveBeenCalledWith(
      'games/99/11/my_file.zip',
      { stream: true },
      'application/octet-stream',
      99,
      7,
      'hash-1',
    )
    expect(tx.gameDownloadResourceFileHistory.update).toHaveBeenCalledWith({
      where: { id: 123 },
      data: { s3_file_key: 'games/99/11/my_file.zip' },
    })
    expect(tx.gameDownloadResourceFileHistory.create).not.toHaveBeenCalled()
    expect(tx.gameDownloadResourceFile.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        file_status: 3,
        s3_file_key: 'games/99/11/my_file.zip',
      },
    })
    expect(activityService.create).toHaveBeenCalledWith(
      {
        type: ActivityType.FILE_UPLOAD_TO_S3,
        user_id: 7,
        game_id: 99,
        file_id: 11,
        file_status: ActivityFileStatus.UPLOADED_TO_S3,
        file_check_status: ActivityFileCheckStatus.OK,
      },
      expect.any(Object),
    )
    expect(messageService.send).toHaveBeenCalledWith(
      {
        type: MessageType.SYSTEM,
        tone: MessageTone.SUCCESS,
        title: 'Messages.System.File.Upload.FileUploadSuccessTitle',
        content: 'Messages.System.File.Upload.FileUploadSuccessContent',
        game_id: 99,
        meta: {
          file_id: 11,
          file_name: '../unsafe/my file.zip',
          file_size: 2048,
        },
        receiver_id: 7,
      },
      expect.any(Object),
    )
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { upload_injected_file_times: 0 },
    })
    expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/upload.bin', { force: true })
  })

  it('creates history entry when no previous history exists', async () => {
    const { processor, prismaService, tx } = makeProcessor()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(makeFile())
    tx.gameDownloadResourceFileHistory.findFirst.mockResolvedValue(null)

    await processor.processS3Upload({ data: { resourceFileId: 11 } } as any)

    expect(tx.gameDownloadResourceFileHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        file_id: 11,
        s3_file_key: 'games/99/11/my_file.zip',
        operator_id: 7,
      }),
    })
    expect(tx.gameDownloadResourceFileHistory.update).not.toHaveBeenCalled()
  })

  it('logs warning when removing local temp file fails', async () => {
    const { processor, prismaService, tx, logger } = makeProcessor()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(makeFile())
    tx.gameDownloadResourceFileHistory.findFirst.mockResolvedValue({ id: 123 })
    ;(fs.promises.rm as jest.Mock).mockRejectedValue(new Error('EACCES'))

    await expect(processor.processS3Upload({ data: { resourceFileId: 11 } } as any)).resolves.toBe(
      undefined,
    )

    expect(logger.warn).toHaveBeenCalledWith('failed to remove local temp file: /tmp/upload.bin')
  })
})
