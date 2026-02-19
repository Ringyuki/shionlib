import { of, throwError } from 'rxjs'
import { B2Service } from './b2.service'

describe('B2Service', () => {
  const createService = () => {
    const httpService = {
      get: jest.fn(),
      post: jest.fn(),
    }
    const configValues = new Map<string, any>([
      ['b2.applicationKeyId', 'app-key-id'],
      ['b2.applicationKey', 'app-key'],
      ['file_download.download_expires_in', 1800],
      ['file_download.download_cdn_host', 'https://cdn.example.com/files'],
    ])
    const configService = {
      get: jest.fn((key: string) => configValues.get(key)),
    }
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    }

    const service = new B2Service(httpService as any, configService as any, cacheService as any)

    return {
      httpService,
      configService,
      cacheService,
      service,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getAuthorizationToken returns cached token when available', async () => {
    const { service, cacheService, httpService } = createService()
    cacheService.get.mockResolvedValueOnce({
      authorizationToken: 'cached-auth',
      apiInfo: {
        storageApi: {
          apiUrl: 'https://api.cached',
          allowed: { buckets: [{ id: 'bucket-cached', name: 'bucket-name' }] },
        },
      },
    })

    await expect((service as any).getAuthorizationToken()).resolves.toEqual({
      authorizationToken: 'cached-auth',
      bucketId: 'bucket-cached',
      apiUrl: 'https://api.cached',
    })
    expect(httpService.get).not.toHaveBeenCalled()
  })

  it('getAuthorizationToken requests auth and caches response on miss', async () => {
    const { service, cacheService, httpService } = createService()
    cacheService.get.mockResolvedValueOnce(null)
    httpService.get.mockReturnValueOnce(
      of({
        data: {
          authorizationToken: 'fresh-auth',
          apiInfo: {
            storageApi: {
              apiUrl: 'https://api.fresh',
              allowed: { buckets: [{ id: 'bucket-fresh', name: 'b' }] },
            },
          },
        },
      }),
    )

    await expect((service as any).getAuthorizationToken()).resolves.toEqual({
      authorizationToken: 'fresh-auth',
      bucketId: 'bucket-fresh',
      apiUrl: 'https://api.fresh',
    })

    expect(httpService.get).toHaveBeenCalledWith(
      'https://api.backblazeb2.com/b2api/v4/b2_authorize_account',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    )
    expect(cacheService.set).toHaveBeenCalledWith(
      'b2:authorizationToken',
      expect.objectContaining({
        authorizationToken: 'fresh-auth',
      }),
      3600 * 1000 * 21,
    )
  })

  it('getDownloadAuthorizationToken uses auth info and default expiration when missing', async () => {
    const { service, httpService } = createService()
    jest.spyOn(service as any, 'getAuthorizationToken').mockResolvedValueOnce({
      authorizationToken: 'auth-token',
      bucketId: 'bucket-id',
      apiUrl: 'https://api.b2',
    })
    httpService.post.mockReturnValueOnce(
      of({
        data: { authorizationToken: 'download-token' },
      }),
    )

    await expect((service as any).getDownloadAuthorizationToken('dir/file.zip')).resolves.toBe(
      'download-token',
    )
    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.b2/b2api/v4/b2_get_download_authorization',
      {
        bucketId: 'bucket-id',
        fileNamePrefix: 'dir/file.zip',
        validDurationInSeconds: 1800,
      },
      {
        headers: {
          Authorization: 'auth-token',
          'Content-Type': 'application/json',
        },
      },
    )
  })

  it('getDownloadUrl builds url with encoded key and custom expiration', async () => {
    const { service } = createService()
    jest
      .spyOn(service as any, 'getDownloadAuthorizationToken')
      .mockResolvedValueOnce('dl-token-1')
      .mockResolvedValueOnce('dl-token-2')

    await expect(service.getDownloadUrl('folder/a b.zip', 60)).resolves.toBe(
      'https://cdn.example.com/files/folder%2Fa%20b.zip?Authorization=dl-token-1',
    )
    ;(service as any).configService.get = jest.fn((key: string) => {
      if (key === 'file_download.download_cdn_host') return 'https://cdn.example.com/files/'
      if (key === 'file_download.download_expires_in') return 1800
      return undefined
    })

    await expect(service.getDownloadUrl('x/y')).resolves.toBe(
      'https://cdn.example.com/files/x%2Fy?Authorization=dl-token-2',
    )
  })

  it('getDownloadUrl logs and rethrows upstream errors', async () => {
    const { service } = createService()
    const err = new Error('download auth failed')
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(service as any, 'getDownloadAuthorizationToken').mockRejectedValueOnce(err)

    await expect(service.getDownloadUrl('any')).rejects.toBe(err)
    expect(errorSpy).toHaveBeenCalledWith('Error getting download URL for key: any', err)

    errorSpy.mockRestore()
  })

  it('bubbles errors from authorization request', async () => {
    const { service, cacheService, httpService } = createService()
    cacheService.get.mockResolvedValueOnce(null)
    httpService.get.mockReturnValueOnce(throwError(() => new Error('auth failed')))

    await expect((service as any).getAuthorizationToken()).rejects.toThrow('auth failed')
  })
})
