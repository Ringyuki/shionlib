import { promises as fs } from 'fs'
import { of, throwError } from 'rxjs'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { BangumiAuthService } from './bangumi-auth.service'

describe('BangumiAuthService', () => {
  const createService = (overrides?: Partial<Record<string, any>>) => {
    const configValues = new Map<string, any>([
      ['bangumi.clientId', overrides?.clientId ?? 'client-id'],
      ['bangumi.clientSecret', overrides?.clientSecret ?? 'client-secret'],
    ])
    const configService = {
      get: jest.fn((key: string) => configValues.get(key)),
    }
    const httpService = {
      post: jest.fn(),
      request: jest.fn(),
    }
    const service = new BangumiAuthService(configService as any, httpService as any)

    return { configService, httpService, service }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('onModuleInit logs success when tokens loaded', async () => {
    const { service } = createService()
    const loadSpy = jest.spyOn(service, 'loadTokens').mockResolvedValueOnce({
      access_token: 'a',
      refresh_token: 'r',
    } as any)
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})

    await service.onModuleInit()

    expect(loadSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('Bangumi tokens loaded successfully')
    logSpy.mockRestore()
  })

  it('onModuleInit logs warning when load fails', async () => {
    const { service } = createService()
    jest.spyOn(service, 'loadTokens').mockRejectedValueOnce(new Error('load failed'))
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {})

    await service.onModuleInit()

    expect(warnSpy).toHaveBeenCalledWith('Failed to load Bangumi tokens on startup', 'load failed')
    warnSpy.mockRestore()
  })

  it('loadTokens returns cached tokens when token still valid', async () => {
    const { service } = createService()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const readSpy = jest.spyOn(fs, 'readFile').mockResolvedValueOnce(
      JSON.stringify({
        access_token: 'a',
        refresh_token: 'r',
        expires_at: 2_000_000,
      }) as any,
    )
    const refreshSpy = jest.spyOn(service, 'refreshAccessToken')

    await expect(service.loadTokens()).resolves.toEqual({
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 2_000_000,
    })
    expect(refreshSpy).not.toHaveBeenCalled()

    nowSpy.mockRestore()
    readSpy.mockRestore()
  })

  it('loadTokens refreshes when token expired', async () => {
    const { service } = createService()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
    jest.spyOn(fs, 'readFile').mockResolvedValueOnce(
      JSON.stringify({
        access_token: 'a',
        refresh_token: 'r',
        expires_at: 900_000,
      }) as any,
    )
    const refreshSpy = jest.spyOn(service, 'refreshAccessToken').mockResolvedValueOnce({
      access_token: 'new-a',
      refresh_token: 'new-r',
    } as any)
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})

    await expect(service.loadTokens()).resolves.toEqual({
      access_token: 'new-a',
      refresh_token: 'new-r',
    })
    expect(refreshSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('Token expired, attempting refresh...')

    nowSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('loadTokens throws friendly error when file is missing/invalid', async () => {
    const { service } = createService()
    jest.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('ENOENT') as any)
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})

    await expect(service.loadTokens()).rejects.toThrow(
      'No valid tokens found. Please complete OAuth flow first.',
    )
    expect(errorSpy).toHaveBeenCalledWith('Error loading tokens:', 'ENOENT')

    errorSpy.mockRestore()
  })

  it('saveTokens writes token file and enriches expiry metadata', async () => {
    const { service } = createService()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValueOnce(undefined as any)
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValueOnce(undefined as any)
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})

    await (service as any).saveTokens({
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
    })

    expect(mkdirSpy).toHaveBeenCalled()
    expect(writeSpy).toHaveBeenCalledTimes(1)
    const [, payload] = writeSpy.mock.calls[0]
    const json = JSON.parse(String(payload))
    expect(json.expires_at).toBe(1_000_000 + 3600 * 1000)
    expect(json.saved_at).toBe(1_000_000)
    expect((service as any).tokens.access_token).toBe('a')
    expect(logSpy).toHaveBeenCalledWith('Tokens saved successfully')

    nowSpy.mockRestore()
    mkdirSpy.mockRestore()
    writeSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('refreshAccessToken deduplicates concurrent refresh calls', async () => {
    const { service } = createService()
    const resolved = {
      access_token: 'new-a',
      refresh_token: 'new-r',
      token_type: 'Bearer',
      expires_in: 3600,
      expires_at: 2_000_000,
    }

    let resolvePromise: (v: any) => void = () => {}
    const deferred = new Promise(resolve => {
      resolvePromise = resolve
    })
    const doRefreshSpy = jest
      .spyOn(service as any, '_doRefreshToken')
      .mockReturnValue(deferred as any)

    const p1 = service.refreshAccessToken('r1')
    const p2 = service.refreshAccessToken('r2')
    expect(doRefreshSpy).toHaveBeenCalledTimes(1)

    resolvePromise(resolved)
    await expect(p1).resolves.toEqual(resolved)
    await expect(p2).resolves.toEqual(resolved)
    expect((service as any).refreshPromise).toBeNull()
  })

  it('_doRefreshToken refreshes, saves tokens and handles non-200/error responses', async () => {
    const { service, httpService } = createService()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const saveSpy = jest.spyOn(service as any, 'saveTokens').mockResolvedValue(undefined)
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})

    httpService.post.mockReturnValueOnce(
      of({
        status: 200,
        data: {
          access_token: 'a1',
          refresh_token: 'r1',
          expires_in: 100,
          token_type: 'Bearer',
        },
      }),
    )
    await expect((service as any)._doRefreshToken('external-r')).resolves.toEqual({
      access_token: 'a1',
      refresh_token: 'r1',
      token_type: 'Bearer',
      expires_in: 100,
      expires_at: 1_100_000,
    })
    expect(saveSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('Successfully refreshed access token')

    httpService.post.mockReturnValueOnce(of({ status: 500, data: {} }))
    await expect((service as any)._doRefreshToken('external-r')).rejects.toThrow(
      'Token refresh failed: 500',
    )

    httpService.post.mockReturnValueOnce(throwError(() => new Error('network down')))
    await expect((service as any)._doRefreshToken('external-r')).rejects.toThrow('network down')
    expect(errorSpy).toHaveBeenCalledWith('Error refreshing token:', 'network down')

    nowSpy.mockRestore()
    saveSpy.mockRestore()
    errorSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('getValidAccessToken loads missing tokens and refreshes expired tokens', async () => {
    const { service } = createService()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const loadedTokens = {
      access_token: 'loaded-a',
      refresh_token: 'loaded-r',
      expires_at: 1_500_000,
    }
    const loadSpy = jest.spyOn(service, 'loadTokens').mockImplementation(async () => {
      ;(service as any).tokens = loadedTokens
      return loadedTokens as any
    })

    await expect(service.getValidAccessToken()).resolves.toBe('loaded-a')
    expect(loadSpy).toHaveBeenCalled()
    ;(service as any).tokens = {
      access_token: 'old-a',
      refresh_token: 'old-r',
      expires_at: 900_000,
    }
    const refreshTokens = {
      access_token: 'new-a',
      refresh_token: 'new-r',
      expires_at: 2_000_000,
    }
    const refreshSpy = jest.spyOn(service, 'refreshAccessToken').mockImplementation(async () => {
      ;(service as any).tokens = refreshTokens
      return refreshTokens as any
    })

    await expect(service.getValidAccessToken()).resolves.toBe('new-a')
    expect(refreshSpy).toHaveBeenCalled()

    nowSpy.mockRestore()
  })

  it('clearTokens and getTokenInfo handle both success and fallback paths', async () => {
    const { service } = createService()
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {})

    ;(service as any).tokens = {
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 123,
      token_type: 'Bearer',
    }
    expect(service.getTokenInfo()).toEqual({
      hasToken: true,
      expiresAt: 123,
      tokenType: 'Bearer',
    })

    const unlinkSpy = jest.spyOn(fs, 'unlink').mockResolvedValueOnce(undefined as any)
    await service.clearTokens()
    expect((service as any).tokens).toBeNull()
    expect(logSpy).toHaveBeenCalledWith('Tokens cleared successfully')

    jest.spyOn(fs, 'unlink').mockRejectedValueOnce(new Error('perm denied') as any)
    await expect(service.clearTokens()).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith('Failed to clear tokens:', 'perm denied')

    expect(service.getTokenInfo()).toEqual({ hasToken: false })

    unlinkSpy.mockRestore()
    logSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('bangumiRequest sends authorized request and wraps upstream errors', async () => {
    const { service, httpService } = createService()
    jest.spyOn(service, 'getValidAccessToken').mockResolvedValue('access-token')

    httpService.request.mockReturnValueOnce(of({ data: { ok: true } }))
    await expect(
      service.bangumiRequest<{ ok: boolean }>(
        'https://api.bgm.tv/test',
        'POST',
        { a: 1 },
        { b: 2 },
      ),
    ).resolves.toEqual({ ok: true })
    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.bgm.tv/test',
        method: 'POST',
        params: { a: 1 },
        data: { b: 2 },
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    )

    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {})
    httpService.request.mockReturnValueOnce(throwError(() => new Error('upstream fail')))
    await expect(service.bangumiRequest('https://api.bgm.tv/test')).rejects.toMatchObject({
      code: ShionBizCode.GAME_BANGUMI_REQUEST_FAILED,
    })
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('upstream fail'))
    errorSpy.mockRestore()
  })
})
