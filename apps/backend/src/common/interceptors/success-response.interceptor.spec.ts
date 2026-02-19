import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { I18nContext, I18nService } from 'nestjs-i18n'
import { lastValueFrom, of } from 'rxjs'
import { ShionBizCode } from '../../shared/enums/biz-code/shion-biz-code.enum'
import { SuccessResponseInterceptor } from './success-response.interceptor'

const createExecutionContext = (req: any, res: any): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getHandler: () => function handler() {},
  }) as unknown as ExecutionContext

describe('SuccessResponseInterceptor', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'get'>>
  let i18n: jest.Mocked<Pick<I18nService, 't'>>
  let interceptor: SuccessResponseInterceptor

  beforeEach(() => {
    reflector = { get: jest.fn() }
    i18n = { t: jest.fn((key: string) => `t:${key}` as any) }
    interceptor = new SuccessResponseInterceptor(
      reflector as unknown as Reflector,
      i18n as unknown as I18nService,
    )
    jest.spyOn(I18nContext, 'current').mockReturnValue({ lang: 'zh-CN' } as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('wraps payload with message key translation and request id', async () => {
    const req = { id: 'req-1' }
    const res = { setHeader: jest.fn() }
    const ctx = createExecutionContext(req, res)
    const next: CallHandler = { handle: () => of({ ok: true }) }

    reflector.get.mockReturnValue('test.key')

    const result = await lastValueFrom(interceptor.intercept(ctx, next))

    expect(i18n.t).toHaveBeenCalledWith('test.key', {
      lang: 'zh-CN',
      args: { ok: true },
    })
    expect(result).toMatchObject({
      code: ShionBizCode.COMMON_SUCCESS,
      message: 't:test.key',
      data: { ok: true },
      requestId: 'req-1',
    })
    expect(typeof result.timestamp).toBe('string')
    expect(res.setHeader).not.toHaveBeenCalled()
  })

  it('uses default success key when no response message key metadata', async () => {
    const req = {}
    const res = { setHeader: jest.fn() }
    const ctx = createExecutionContext(req, res)
    const next: CallHandler = { handle: () => of({ value: 1 }) }

    reflector.get.mockReturnValue(undefined)

    const result = await lastValueFrom(interceptor.intercept(ctx, next))

    expect(i18n.t).toHaveBeenCalledWith('common.success', {
      lang: 'zh-CN',
    })
    expect(result).toMatchObject({
      code: ShionBizCode.COMMON_SUCCESS,
      message: 't:common.success',
      data: { value: 1 },
      requestId: '',
    })
  })

  it('injects stale auth meta and response header when optional token is stale', async () => {
    const req = {
      id: 'req-2',
      auth: { optionalTokenStale: true },
    }
    const res = { setHeader: jest.fn() }
    const ctx = createExecutionContext(req, res)
    const next: CallHandler = { handle: () => of({ done: true }) }

    reflector.get.mockReturnValue(undefined)

    const result = await lastValueFrom(interceptor.intercept(ctx, next))

    expect(res.setHeader).toHaveBeenCalledWith('shionlib-auth-stale', '1')
    expect(result).toMatchObject({
      meta: {
        auth: {
          optionalTokenStale: true,
          optionalTokenReason: 'invalid_token',
        },
      },
    })
  })
})
