import * as fs from 'fs'
import * as path from 'path'
import { FileCleanService } from './file-clean.service'

describe('FileCleanService', () => {
  const createService = () => {
    const prismaService = {
      gameUploadSession: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      gameDownloadResourceFile: {
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      gameDownloadResource: {
        delete: jest.fn(),
      },
    }
    const configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, any> = {
          'file_upload.upload_root_dir': '/tmp/shion-upload',
          'file_upload.upload_temp_file_suffix': '.upload',
        }
        return map[key]
      }),
    }
    const uploadQuotaService = {
      withdrawUploadQuotaUseAdjustment: jest.fn(),
    }

    const service = new FileCleanService(
      prismaService as any,
      configService as any,
      uploadQuotaService as any,
    )
    return {
      prismaService,
      configService,
      uploadQuotaService,
      service,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clean processes sessions/files and removes stale orphan temp files', async () => {
    const { service, prismaService, uploadQuotaService } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z').getTime()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now)

    prismaService.gameUploadSession.findMany
      .mockResolvedValueOnce([
        { id: 1, storage_path: '/tmp/shion-upload/s1.upload', creator_id: 11 },
        { id: 2, storage_path: '/outside/s2.upload', creator_id: 12 },
      ])
      .mockResolvedValueOnce([{ storage_path: '/tmp/shion-upload/keep.upload' }])
    prismaService.gameDownloadResourceFile.findMany
      .mockResolvedValueOnce([
        { id: 101, file_path: '/tmp/shion-upload/u1.upload' },
        { id: 102, file_path: '/outside/u2.upload' },
      ])
      .mockResolvedValueOnce([
        {
          id: 201,
          file_path: '/tmp/shion-upload/r1.upload',
          upload_session_id: 301,
          creator_id: 21,
          game_download_resource_id: 401,
        },
        {
          id: 202,
          file_path: '/outside/r2.upload',
          upload_session_id: null,
          creator_id: null,
          game_download_resource_id: null,
        },
      ])
      .mockResolvedValueOnce([{ file_path: '/tmp/shion-upload/referenced.upload' }])

    const rmSpy = jest
      .spyOn(fs.promises, 'rm')
      .mockRejectedValueOnce(new Error('remove failed'))
      .mockResolvedValue(undefined as any)
    const readdirSpy = jest
      .spyOn(fs.promises, 'readdir')
      .mockResolvedValue(['orphan.upload', 'keep.upload', 'broken.upload', 'ignore.txt'] as any)
    const statSpy = jest.spyOn(fs.promises, 'stat').mockImplementation(async (p: any) => {
      const file = String(p)
      if (file.endsWith('orphan.upload')) {
        return { mtimeMs: now - 49 * 60 * 60 * 1000 } as any
      }
      if (file.endsWith('broken.upload')) {
        throw new Error('stat failed')
      }
      return { mtimeMs: now - 10 * 60 * 1000 } as any
    })

    await service.clean()

    expect(prismaService.gameUploadSession.update).toHaveBeenCalledTimes(2)
    expect(prismaService.gameUploadSession.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: { status: 'EXPIRED' },
    })
    expect(prismaService.gameUploadSession.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: { status: 'EXPIRED' },
    })
    expect(uploadQuotaService.withdrawUploadQuotaUseAdjustment).toHaveBeenCalledWith(11, 1)
    expect(uploadQuotaService.withdrawUploadQuotaUseAdjustment).toHaveBeenCalledWith(12, 2)
    expect(uploadQuotaService.withdrawUploadQuotaUseAdjustment).toHaveBeenCalledWith(21, 301)

    expect(prismaService.gameDownloadResourceFile.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { file_path: null },
    })
    expect(prismaService.gameDownloadResourceFile.delete).toHaveBeenCalledTimes(2)
    expect(prismaService.gameDownloadResource.delete).toHaveBeenCalledWith({
      where: { id: 401 },
    })

    expect(readdirSpy).toHaveBeenCalledWith('/tmp/shion-upload')
    expect(rmSpy).toHaveBeenCalledWith('/tmp/shion-upload/s1.upload', { force: true })
    expect(rmSpy).toHaveBeenCalledWith('/tmp/shion-upload/u1.upload', { force: true })
    expect(rmSpy).toHaveBeenCalledWith('/tmp/shion-upload/r1.upload', { force: true })
    expect(rmSpy).toHaveBeenCalledWith(path.join('/tmp/shion-upload', 'orphan.upload'), {
      force: true,
    })
    expect(statSpy).toHaveBeenCalledWith(path.join('/tmp/shion-upload', 'orphan.upload'))
    expect(statSpy).toHaveBeenCalledWith(path.join('/tmp/shion-upload', 'broken.upload'))

    nowSpy.mockRestore()
    rmSpy.mockRestore()
    readdirSpy.mockRestore()
    statSpy.mockRestore()
  })

  it('clean skips orphan ref scan when readdir fails', async () => {
    const { service, prismaService } = createService()
    prismaService.gameUploadSession.findMany.mockResolvedValueOnce([])
    prismaService.gameDownloadResourceFile.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const readdirSpy = jest
      .spyOn(fs.promises, 'readdir')
      .mockRejectedValueOnce(new Error('no dir') as any)

    await expect(service.clean()).resolves.toBeUndefined()

    expect(prismaService.gameUploadSession.findMany).toHaveBeenCalledTimes(1)
    expect(prismaService.gameDownloadResourceFile.findMany).toHaveBeenCalledTimes(2)
    readdirSpy.mockRestore()
  })
})
