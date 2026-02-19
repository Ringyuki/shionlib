jest.mock('child_process', () => ({
  spawn: jest.fn(),
}))

import { EventEmitter } from 'events'
import { Readable } from 'stream'
import { spawn } from 'child_process'
import { InternalServerErrorException } from '@nestjs/common'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { S3Service } from '../../s3/services/s3.service'
import { BackupService } from './backup.service'

describe('BackupService', () => {
  const spawnMock = spawn as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService(options?: {
    enableBackup?: boolean
    databaseUrl?: string
    retention?: number
    backupStorage?: Partial<S3Service> | null
  }) {
    const backupStorage =
      options?.backupStorage === null
        ? null
        : ({
            uploadFileStream: jest.fn(),
            deleteFile: jest.fn(),
            getFileList: jest.fn(),
            ...options?.backupStorage,
          } as unknown as S3Service)

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'database.enable_backup') return options?.enableBackup ?? true
        if (key === 'database.url')
          return options?.databaseUrl ?? 'postgres://user:pw@localhost:5432/db'
        if (key === 'database.backup_retention') return options?.retention ?? 2
        return undefined
      }),
    } as unknown as ShionConfigService

    const service = new BackupService(backupStorage as any, config)

    return {
      service,
      backupStorage,
      config,
    }
  }

  function createMockPgDumpProcess() {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
    }
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    return proc
  }

  it('dumpDatabase returns undefined when backup is disabled', async () => {
    const { service } = createService({ enableBackup: false })

    await expect(service.dumpDatabase()).resolves.toBeUndefined()
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('dumpDatabase throws when database url is missing', async () => {
    const { service } = createService({ databaseUrl: '' })
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    await expect(service.dumpDatabase()).rejects.toBeInstanceOf(InternalServerErrorException)
    expect(errorSpy).toHaveBeenCalledWith('Database URL is not set')
  })

  it('dumpDatabase resolves buffer when pg_dump exits with code 0', async () => {
    const { service } = createService()
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation()
    const proc = createMockPgDumpProcess()
    spawnMock.mockReturnValue(proc)

    const promise = service.dumpDatabase()
    proc.stdout.emit('data', Buffer.from('abc'))
    proc.stdout.emit('data', Buffer.from('123'))
    proc.emit('close', 0)

    await expect(promise).resolves.toEqual(Buffer.from('abc123'))
    expect(spawnMock).toHaveBeenCalledWith(
      'pg_dump',
      [
        '--format=custom',
        '--encoding=UTF8',
        '--no-owner',
        '--no-privileges',
        'postgres://user:pw@localhost:5432/db',
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    expect(logSpy).toHaveBeenCalledWith('pg_dump finished successfully')
  })

  it('dumpDatabase rejects when pg_dump emits error', async () => {
    const { service } = createService()
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()
    const proc = createMockPgDumpProcess()
    spawnMock.mockReturnValue(proc)

    const promise = service.dumpDatabase()
    proc.emit('error', new Error('spawn failed'))

    await expect(promise).rejects.toBeInstanceOf(InternalServerErrorException)
    expect(errorSpy).toHaveBeenCalledWith('Failed to start pg_dump: spawn failed')
  })

  it('dumpDatabase rejects when pg_dump exits non-zero and logs stderr', async () => {
    const { service } = createService()
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()
    const proc = createMockPgDumpProcess()
    spawnMock.mockReturnValue(proc)

    const promise = service.dumpDatabase()
    proc.stderr.emit('data', Buffer.from('permission denied'))
    proc.emit('close', 1)

    await expect(promise).rejects.toBeInstanceOf(InternalServerErrorException)
    expect(errorSpy).toHaveBeenCalledWith('pg_dump exited with code 1: permission denied')
  })

  it('backupToS3 returns early when backup is disabled', async () => {
    const { service } = createService({ enableBackup: false })
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation()

    await expect(service.backupToS3()).resolves.toBeUndefined()
    expect(logSpy).toHaveBeenCalledWith('Database backup is disabled')
  })

  it('backupToS3 throws when backup storage is not set', async () => {
    const { service } = createService({ backupStorage: null })
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    await expect(service.backupToS3()).rejects.toBeInstanceOf(InternalServerErrorException)
    expect(errorSpy).toHaveBeenCalledWith('Backup storage is not set')
  })

  it('backupToS3 throws when dumpDatabase result is empty', async () => {
    const { service } = createService()
    jest.spyOn(service, 'dumpDatabase').mockResolvedValue(undefined as any)

    await expect(service.backupToS3()).rejects.toBeInstanceOf(InternalServerErrorException)
  })

  it('backupToS3 uploads backup and triggers cleanup', async () => {
    const { service, backupStorage } = createService()
    jest.spyOn(service, 'dumpDatabase').mockResolvedValue(Buffer.from('backup-data'))
    ;(backupStorage!.uploadFileStream as jest.Mock).mockResolvedValue({ etag: 'e1' })
    const cleanupSpy = jest.spyOn(service as any, 'cleanupOldBackups').mockResolvedValue(undefined)

    const result = await service.backupToS3()

    expect(backupStorage!.uploadFileStream).toHaveBeenCalledWith(
      expect.stringMatching(/^backup\/database\/.*\.shionlibbackup$/),
      expect.any(Readable),
      'application/octet-stream',
    )
    const uploadedKey = (backupStorage!.uploadFileStream as jest.Mock).mock.calls[0][0]
    expect(cleanupSpy).toHaveBeenCalledWith(uploadedKey)
    expect(result).toEqual({ etag: 'e1' })
  })

  it('cleanupOldBackups exits when retention <= 0', async () => {
    const { service } = createService({ retention: 0 })
    const listSpy = jest.spyOn(service as any, 'listAllBackupObjects')

    await (service as any).cleanupOldBackups('backup/database/latest.shionlibbackup')

    expect(listSpy).not.toHaveBeenCalled()
  })

  it('cleanupOldBackups deletes overflow backups except latest key', async () => {
    const { service, backupStorage } = createService({ retention: 2 })
    jest.spyOn(service as any, 'listAllBackupObjects').mockResolvedValue([
      {
        Key: 'backup/database/newest.shionlibbackup',
        LastModified: new Date('2026-02-18T03:00:00Z'),
      },
      {
        Key: 'backup/database/latest.shionlibbackup',
        LastModified: new Date('2026-02-18T02:00:00Z'),
      },
      {
        Key: 'backup/database/old-1.shionlibbackup',
        LastModified: new Date('2026-02-18T01:00:00Z'),
      },
      {
        Key: 'backup/database/old-2.shionlibbackup',
        LastModified: new Date('2026-02-18T00:00:00Z'),
      },
    ])
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation()

    await (service as any).cleanupOldBackups('backup/database/latest.shionlibbackup')

    expect(backupStorage!.deleteFile).toHaveBeenCalledTimes(2)
    expect(backupStorage!.deleteFile).toHaveBeenNthCalledWith(
      1,
      'backup/database/old-1.shionlibbackup',
      false,
    )
    expect(backupStorage!.deleteFile).toHaveBeenNthCalledWith(
      2,
      'backup/database/old-2.shionlibbackup',
      false,
    )
    expect(logSpy).toHaveBeenCalledWith('Deleted old backup backup/database/old-1.shionlibbackup')
    expect(logSpy).toHaveBeenCalledWith('Deleted old backup backup/database/old-2.shionlibbackup')
  })

  it('cleanupOldBackups logs and swallows prune errors', async () => {
    const { service } = createService({ retention: 2 })
    const pruneError = new Error('list failed')
    jest.spyOn(service as any, 'listAllBackupObjects').mockRejectedValue(pruneError)
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    await expect(
      (service as any).cleanupOldBackups('backup/database/latest.shionlibbackup'),
    ).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith('Failed to prune old backups', pruneError)
  })

  it('listAllBackupObjects iterates pages and filters by backup prefix', async () => {
    const { service, backupStorage } = createService()
    ;(backupStorage!.getFileList as jest.Mock)
      .mockResolvedValueOnce({
        Contents: [
          { Key: 'backup/database/a.shionlibbackup' },
          { Key: 'other/prefix/not-included' },
        ],
        IsTruncated: true,
        NextContinuationToken: 'token-1',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'backup/database/b.shionlibbackup' }],
        IsTruncated: false,
      })

    const objects = await (service as any).listAllBackupObjects()

    expect(backupStorage!.getFileList).toHaveBeenNthCalledWith(1, {
      prefix: 'backup/database/',
      continuationToken: undefined,
    })
    expect(backupStorage!.getFileList).toHaveBeenNthCalledWith(2, {
      prefix: 'backup/database/',
      continuationToken: 'token-1',
    })
    expect(objects).toEqual([
      { Key: 'backup/database/a.shionlibbackup' },
      { Key: 'backup/database/b.shionlibbackup' },
    ])
  })
})
