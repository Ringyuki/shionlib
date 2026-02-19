jest.mock('@aws-sdk/client-s3', () => {
  const cmd = (name: string) =>
    jest.fn().mockImplementation((input: Record<string, any>) => ({
      __type: name,
      input,
    }))

  return {
    __esModule: true,
    S3Client: jest.fn(),
    GetObjectCommand: cmd('GetObjectCommand'),
    PutObjectCommand: cmd('PutObjectCommand'),
    ListObjectsV2Command: cmd('ListObjectsV2Command'),
    DeleteObjectCommand: cmd('DeleteObjectCommand'),
    ListObjectVersionsCommand: cmd('ListObjectVersionsCommand'),
    DeleteObjectsCommand: cmd('DeleteObjectsCommand'),
  }
})

jest.mock('@aws-sdk/lib-storage', () => ({
  __esModule: true,
  Upload: jest.fn(),
}))

import { Readable } from 'node:stream'
import { Upload } from '@aws-sdk/lib-storage'
import { S3Service } from './s3.service'

describe('S3Service', () => {
  const UploadMock = Upload as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService(sendImpl?: (cmd: any) => any) {
    const send = jest.fn((cmd: any) => {
      if (sendImpl) return sendImpl(cmd)
      return Promise.resolve({ ok: true })
    })

    const s3Client = { send }
    const service = new S3Service(s3Client as any, 'test-bucket')

    return {
      service,
      send,
      s3Client,
    }
  }

  it('onModuleInit sends list command and logs success', async () => {
    const { service, send } = createService()
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation()

    await service.onModuleInit()

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({
      __type: 'ListObjectsV2Command',
      input: { Bucket: 'test-bucket' },
    })
    expect(logSpy).toHaveBeenCalledWith('S3 client initialized successfully for bucket test-bucket')
  })

  it('onModuleInit catches and logs error', async () => {
    const error = new Error('init failed')
    const { service } = createService(() => {
      throw error
    })
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation()

    await service.onModuleInit()

    expect(errorSpy).toHaveBeenCalledWith(error)
  })

  it('uploadFile sends put command with metadata', async () => {
    const { service, send } = createService(() => Promise.resolve({ etag: 'e1' }))

    const result = await service.uploadFile('a/b.png', Buffer.from('123'), 'image/png', {
      foo: 'bar',
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        __type: 'PutObjectCommand',
        input: {
          Bucket: 'test-bucket',
          Key: 'a/b.png',
          Body: expect.any(Buffer),
          ContentType: 'image/png',
          Metadata: { foo: 'bar' },
        },
      }),
    )
    expect(result).toEqual({ etag: 'e1' })
  })

  it('uploadFileStream builds metadata and returns upload.done', async () => {
    const done = jest.fn().mockResolvedValue({ ok: true })
    UploadMock.mockImplementation(() => ({ done }))
    const { service, s3Client } = createService()

    const result = await service.uploadFileStream(
      'stream/file.bin',
      Readable.from(['abc']),
      'application/octet-stream',
      1,
      2,
      'sha256',
    )

    expect(UploadMock).toHaveBeenCalledWith({
      client: s3Client,
      params: {
        Bucket: 'test-bucket',
        Key: 'stream/file.bin',
        Body: expect.any(Readable),
        ContentType: 'application/octet-stream',
        Metadata: {
          'game-id': '1',
          'uploader-id': '2',
          'file-sha256': 'sha256',
        },
      },
      queueSize: 4,
      partSize: 1024 * 1024 * 32,
      leavePartsOnError: false,
    })
    expect(done).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })

  it('getFile sends get command', async () => {
    const { service, send } = createService(() => Promise.resolve({ body: 'x' }))

    const result = await service.getFile('file.txt')

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        __type: 'GetObjectCommand',
        input: { Bucket: 'test-bucket', Key: 'file.txt' },
      }),
    )
    expect(result).toEqual({ body: 'x' })
  })

  it('deleteFile hard=true deletes all matched versions and delete markers', async () => {
    const { service, send } = createService((cmd: any) => {
      if (cmd.__type === 'ListObjectVersionsCommand') {
        return Promise.resolve({
          Versions: [
            { Key: 'target.key', VersionId: 'v1' },
            { Key: 'other.key', VersionId: 'v2' },
          ],
          DeleteMarkers: [{ Key: 'target.key', VersionId: 'm1' }],
        })
      }
      return Promise.resolve({ ok: true })
    })

    await service.deleteFile('target.key', true)

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0]).toMatchObject({
      __type: 'ListObjectVersionsCommand',
      input: { Bucket: 'test-bucket', Prefix: 'target.key' },
    })
    expect(send.mock.calls[1][0]).toMatchObject({
      __type: 'DeleteObjectsCommand',
      input: {
        Bucket: 'test-bucket',
        Delete: {
          Objects: [
            { Key: 'target.key', VersionId: 'v1' },
            { Key: 'target.key', VersionId: 'm1' },
          ],
          Quiet: true,
        },
      },
    })
  })

  it('deleteFile hard=true exits early when no version ids found', async () => {
    const { service, send } = createService((cmd: any) => {
      if (cmd.__type === 'ListObjectVersionsCommand') {
        return Promise.resolve({ Versions: [], DeleteMarkers: [] })
      }
      return Promise.resolve({ ok: true })
    })

    await service.deleteFile('target.key', true)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].__type).toBe('ListObjectVersionsCommand')
  })

  it('deleteFile hard=false sends delete object command', async () => {
    const { service, send } = createService()

    await service.deleteFile('plain.key', false)

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        __type: 'DeleteObjectCommand',
        input: { Bucket: 'test-bucket', Key: 'plain.key' },
      }),
    )
  })

  it('getFileList sends list command with options', async () => {
    const { service, send } = createService(() => Promise.resolve({ Contents: [] }))

    const result = await service.getFileList({
      prefix: 'games/',
      continuationToken: 'token',
      maxKeys: 100,
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        __type: 'ListObjectsV2Command',
        input: {
          Bucket: 'test-bucket',
          Prefix: 'games/',
          ContinuationToken: 'token',
          MaxKeys: 100,
        },
      }),
    )
    expect(result).toEqual({ Contents: [] })
  })
})
