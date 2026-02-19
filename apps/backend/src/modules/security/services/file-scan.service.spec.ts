const mockNodeClamInit = jest.fn()
const mockNodeClamConstructor = jest.fn(() => ({ init: mockNodeClamInit }))
const mockExecFileAsync = jest.fn()

jest.mock('clamscan', () => ({
  __esModule: true,
  default: mockNodeClamConstructor,
}))

jest.mock('node:util', () => {
  const actual = jest.requireActual('node:util')
  return {
    ...actual,
    promisify: jest.fn(() => mockExecFileAsync),
  }
})

jest.mock('node:fs/promises', () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn(),
    open: jest.fn(),
  },
}))

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import NodeClam from 'clamscan'
import { ActivityFileCheckStatus, ActivityType } from '../../activity/dto/create-activity.dto'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'
import { ArchiveStatus } from '../enums/archive-status.enum'
import { FILE_CHECK_STATUS_MAP, S3_UPLOAD_JOB } from '../../upload/constants/upload.constants'
import { FileScanService } from './file-scan.service'

describe('FileScanService', () => {
  const fsMock = fs as unknown as {
    mkdir: jest.Mock
    open: jest.Mock
  }
  const nodeClamMock = NodeClam as unknown as jest.Mock

  const createService = () => {
    const prismaService = {
      gameDownloadResourceFile: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }

    const configValues = new Map<string, any>([
      ['file_scan.clamscan_binary_path', '/usr/bin/clamscan'],
      ['file_scan.clamscan_db_path', '/var/lib/clamav'],
      ['file_scan.clamscan_scan_log_path', '/var/log/shionlib/clamav/scan.log'],
    ])
    const configService = {
      get: jest.fn((key: string) => configValues.get(key)),
    }

    const uploadQueue = {
      add: jest.fn(),
    }

    const uploadQuotaService = {
      withdrawUploadQuotaUseAdjustment: jest.fn(),
    }

    const activityService = {
      create: jest.fn(),
    }

    const messageService = {
      send: jest.fn(),
    }

    const malwareScanCaseService = {
      processExpiredCases: jest.fn(),
      registerInfectedFile: jest.fn(),
    }

    const service = new FileScanService(
      prismaService as any,
      configService as any,
      uploadQueue as any,
      uploadQuotaService as any,
      activityService as any,
      messageService as any,
      malwareScanCaseService as any,
    )

    ;(service as any).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }

    return {
      prismaService,
      configService,
      uploadQueue,
      uploadQuotaService,
      activityService,
      messageService,
      malwareScanCaseService,
      service,
    }
  }

  const createFileRecord = () => ({
    id: 11,
    file_size: 2048,
    file_name: 'archive.7z',
    file_hash: 'abc123',
    hash_algorithm: 'md5',
    game_download_resource: {
      id: 99,
      game_id: 77,
    },
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockNodeClamInit.mockReset()
    mockExecFileAsync.mockReset()
  })

  it('onModuleInit validates required config', async () => {
    const { service, configService } = createService()
    configService.get.mockImplementation((key: string) => {
      if (key === 'file_scan.clamscan_binary_path') return ''
      if (key === 'file_scan.clamscan_db_path') return '/db'
      return '/log'
    })

    await expect(service.onModuleInit()).rejects.toThrow(
      'Clamscan binary path or database path is not set',
    )
  })

  it('onModuleInit initializes clamscan successfully', async () => {
    const { service } = createService()
    const clam = { scanFile: jest.fn() }
    mockNodeClamInit.mockResolvedValueOnce(clam)
    jest.spyOn(service as any, 'ensureDir').mockResolvedValueOnce('/tmp/scan.log')

    await service.onModuleInit()

    expect(nodeClamMock).toHaveBeenCalledTimes(1)
    expect(mockNodeClamInit).toHaveBeenCalledWith({
      scanLog: '/tmp/scan.log',
      clamdscan: { active: false },
      clamscan: {
        path: '/usr/bin/clamscan',
        db: '/var/lib/clamav',
        scanArchives: true,
        active: true,
      },
      preference: 'clamscan',
    })
    expect((service as any).clam).toBe(clam)
  })

  it('onModuleInit logs and rethrows init errors', async () => {
    const { service } = createService()
    const err = new Error('init failed')
    mockNodeClamInit.mockRejectedValueOnce(err)
    jest.spyOn(service as any, 'ensureDir').mockResolvedValueOnce('/tmp/scan.log')

    await expect(service.onModuleInit()).rejects.toThrow('init failed')
    expect((service as any).logger.error).toHaveBeenCalledWith(err)
  })

  it('scanFiles scans all pending files and returns count', async () => {
    const { service, prismaService } = createService()
    prismaService.gameDownloadResourceFile.findMany.mockResolvedValue([
      { file_path: '/tmp/a.7z', creator_id: 1, upload_session_id: 10 },
      { file_path: '/tmp/b.7z', creator_id: 2, upload_session_id: 20 },
    ])
    const scanFileSpy = jest.spyOn(service as any, 'scanFile').mockResolvedValue(undefined)

    const count = await service.scanFiles()

    expect(count).toBe(2)
    expect(scanFileSpy).toHaveBeenNthCalledWith(1, '/tmp/a.7z', 1, 10)
    expect(scanFileSpy).toHaveBeenNthCalledWith(2, '/tmp/b.7z', 2, 20)
  })

  it('processExpiredMalwareCases delegates to malware case service', async () => {
    const { service, malwareScanCaseService } = createService()
    malwareScanCaseService.processExpiredCases.mockResolvedValue({ ok: true })

    const result = await service.processExpiredMalwareCases()
    expect(result).toEqual({ ok: true })
    expect(malwareScanCaseService.processExpiredCases).toHaveBeenCalledTimes(1)
  })

  it('scanFile skips when file record does not exist', async () => {
    const { service, prismaService } = createService()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(null)
    const inspectSpy = jest.spyOn(service as any, 'inspectArchive')

    await (service as any).scanFile('/tmp/missing.7z', 1, 2)

    expect(inspectSpy).not.toHaveBeenCalled()
    expect((service as any).logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/missing.7z not found'),
    )
  })

  it('scanFile handles broken/truncated archives', async () => {
    const {
      service,
      prismaService,
      uploadQuotaService,
      activityService,
      messageService,
      uploadQueue,
      malwareScanCaseService,
    } = createService()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(createFileRecord())
    jest
      .spyOn(service as any, 'inspectArchive')
      .mockResolvedValue(ArchiveStatus.BROKEN_OR_TRUNCATED)

    await (service as any).scanFile('/tmp/broken.7z', 9, 100)

    expect(prismaService.gameDownloadResourceFile.update).toHaveBeenCalledWith({
      where: { file_path: '/tmp/broken.7z' },
      data: { file_check_status: ArchiveStatus.BROKEN_OR_TRUNCATED },
    })
    expect(uploadQuotaService.withdrawUploadQuotaUseAdjustment).toHaveBeenCalledWith(9, 100)
    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ActivityType.FILE_CHECK_BROKEN_OR_TRUNCATED,
        file_check_status: ActivityFileCheckStatus.BROKEN_OR_TRUNCATED,
      }),
    )
    expect(messageService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.SYSTEM,
        tone: MessageTone.DESTRUCTIVE,
        receiver_id: 9,
        game_id: 77,
        meta: expect.objectContaining({
          file_check_status: ArchiveStatus.BROKEN_OR_TRUNCATED,
          reason: FILE_CHECK_STATUS_MAP[ArchiveStatus.BROKEN_OR_TRUNCATED],
        }),
      }),
    )
    expect(uploadQueue.add).not.toHaveBeenCalled()
    expect(malwareScanCaseService.registerInfectedFile).not.toHaveBeenCalled()
  })

  it('scanFile maps encrypted archive status to encrypted activity type', async () => {
    const { service, prismaService, activityService } = createService()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(createFileRecord())
    jest.spyOn(service as any, 'inspectArchive').mockResolvedValue(ArchiveStatus.ENCRYPTED)

    await (service as any).scanFile('/tmp/encrypted.7z', 7, 70)

    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ActivityType.FILE_CHECK_ENCRYPTED,
        file_check_status: ActivityFileCheckStatus.ENCRYPTED,
      }),
    )
  })

  it('scanFile maps broken/unsupported archive status to corresponding activity', async () => {
    const { service, prismaService, activityService } = createService()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(createFileRecord())
    jest
      .spyOn(service as any, 'inspectArchive')
      .mockResolvedValue(ArchiveStatus.BROKEN_OR_UNSUPPORTED)

    await (service as any).scanFile('/tmp/unsupported.7z', 7, 70)

    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ActivityType.FILE_CHECK_BROKEN_OR_UNSUPPORTED,
        file_check_status: ActivityFileCheckStatus.BROKEN_OR_UNSUPPORTED,
      }),
    )
  })

  it('scanFile registers infected file when clamscan detects malware', async () => {
    const { service, prismaService, malwareScanCaseService, uploadQueue } = createService()
    const file = createFileRecord()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(file)
    jest.spyOn(service as any, 'inspectArchive').mockResolvedValue(ArchiveStatus.OK)
    ;(service as any).clam = {
      scanFile: jest
        .fn()
        .mockResolvedValue({ isInfected: true, viruses: ['Eicar-Test-Signature'] }),
    }

    await (service as any).scanFile('/tmp/infected.7z', 8, 80)

    expect(malwareScanCaseService.registerInfectedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: file.id,
        filePath: '/tmp/infected.7z',
        resourceId: file.game_download_resource.id,
        gameId: file.game_download_resource.game_id,
        uploaderId: 8,
        fileName: file.file_name,
      }),
    )
    expect(uploadQueue.add).not.toHaveBeenCalled()
  })

  it('scanFile marks clean file as OK then enqueues s3 upload', async () => {
    const { service, prismaService, uploadQueue, activityService } = createService()
    const file = createFileRecord()
    prismaService.gameDownloadResourceFile.findUnique.mockResolvedValue(file)
    jest.spyOn(service as any, 'inspectArchive').mockResolvedValue(ArchiveStatus.OK)
    ;(service as any).clam = {
      scanFile: jest.fn().mockResolvedValue({ isInfected: false }),
    }

    await (service as any).scanFile('/tmp/clean.7z', 3, 30)

    expect(prismaService.gameDownloadResourceFile.update).toHaveBeenCalledWith({
      where: { file_path: '/tmp/clean.7z' },
      data: { file_check_status: ArchiveStatus.OK },
    })
    expect(uploadQueue.add).toHaveBeenCalledWith(
      S3_UPLOAD_JOB,
      { resourceFileId: file.id },
      {
        jobId: `s3-upload:${file.id.toString()}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
      },
    )
    expect(activityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ActivityType.FILE_CHECK_OK,
        file_check_status: ActivityFileCheckStatus.OK,
      }),
    )
  })

  it('inspectArchive maps list-stage failures', async () => {
    const { service } = createService()

    mockExecFileAsync.mockRejectedValueOnce({
      stdout: '',
      stderr: 'Wrong password',
      message: 'failed',
    })
    await expect((service as any).inspectArchive('/tmp/pwd.7z')).resolves.toBe(
      ArchiveStatus.ENCRYPTED,
    )

    mockExecFileAsync.mockRejectedValueOnce({
      stdout: '',
      stderr: 'Headers Error',
      message: 'failed',
    })
    await expect((service as any).inspectArchive('/tmp/bad.7z')).resolves.toBe(
      ArchiveStatus.BROKEN_OR_TRUNCATED,
    )

    mockExecFileAsync.mockRejectedValueOnce({
      stdout: '',
      stderr: 'not parsable',
      message: 'failed',
    })
    await expect((service as any).inspectArchive('/tmp/unknown.7z')).resolves.toBe(
      ArchiveStatus.BROKEN_OR_UNSUPPORTED,
    )
  })

  it('inspectArchive handles list-stage metadata checks', async () => {
    const { service } = createService()

    mockExecFileAsync.mockResolvedValueOnce({
      stdout: 'Type = Rar\nMultivolume = +\nHeaders Error',
      stderr: '',
    })
    await expect((service as any).inspectArchive('/tmp/multi.rar')).resolves.toBe(
      ArchiveStatus.BROKEN_OR_TRUNCATED,
    )

    mockExecFileAsync.mockResolvedValueOnce({
      stdout: 'Encrypted = +',
      stderr: '',
    })
    await expect((service as any).inspectArchive('/tmp/encrypted.rar')).resolves.toBe(
      ArchiveStatus.ENCRYPTED,
    )
  })

  it('inspectArchive handles t-stage output and error branches', async () => {
    const { service } = createService()

    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'Data Error', stderr: '' })
    await expect((service as any).inspectArchive('/tmp/dataerr.7z')).resolves.toBe(
      ArchiveStatus.BROKEN_OR_TRUNCATED,
    )

    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
      .mockRejectedValueOnce({ stdout: 'Unsupported Method', stderr: '', message: 'exit 2' })
    await expect((service as any).inspectArchive('/tmp/unsupported.7z')).resolves.toBe(
      ArchiveStatus.OK,
    )

    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
      .mockRejectedValueOnce({ stdout: '', stderr: '', message: 'stdout maxBuffer exceeded' })
    await expect((service as any).inspectArchive('/tmp/buffer.7z')).resolves.toBe(ArchiveStatus.OK)

    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
      .mockRejectedValueOnce({ stdout: '', stderr: '', message: 'mystery fail', code: 2 })
    await expect((service as any).inspectArchive('/tmp/mystery.7z')).resolves.toBe(
      ArchiveStatus.BROKEN_OR_UNSUPPORTED,
    )
  })

  it('ensureDir uses primary path, cwd fallback, then tmp fallback', async () => {
    const { service } = createService()
    const close = jest.fn().mockResolvedValue(undefined)

    fsMock.mkdir.mockResolvedValueOnce(undefined)
    fsMock.open.mockResolvedValueOnce({ close })
    await expect((service as any).ensureDir('/var/log/scan.log')).resolves.toBe('/var/log/scan.log')

    fsMock.mkdir.mockRejectedValueOnce(new Error('mkdir fail')).mockResolvedValueOnce(undefined)
    fsMock.open.mockResolvedValueOnce({ close })
    const fallback = path.join(process.cwd(), 'logs', 'scan.log')
    await expect((service as any).ensureDir('/opt/app/scan.log')).resolves.toBe(fallback)

    jest.spyOn(os, 'tmpdir').mockReturnValue('/tmp/test-fs')
    fsMock.mkdir
      .mockRejectedValueOnce(new Error('mkdir fail'))
      .mockRejectedValueOnce(new Error('mkdir fail'))
    fsMock.open.mockResolvedValueOnce({ close })
    await expect((service as any).ensureDir('/root/no-perm/scan.log')).resolves.toBe(
      '/tmp/test-fs/scan.log',
    )
  })
})
