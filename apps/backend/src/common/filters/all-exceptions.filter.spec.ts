import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { I18nContext, I18nService, I18nValidationException } from 'nestjs-i18n'
import { ShionBizException } from '../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../shared/enums/biz-code/shion-biz-code.enum'
import { AllExceptionsFilter } from './all-exceptions.filter'

jest.mock('../validation/formatting-validation-message.utl', () => ({
  formattingValidationMessage: jest.fn((raw: unknown) => `fmt:${String(raw)}`),
}))

type HostMocks = {
  host: ArgumentsHost
  status: jest.Mock
  json: jest.Mock
}

const createHost = (reqOverride: Partial<any> = {}): HostMocks => {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const req = {
    id: 'req-1',
    method: 'GET',
    originalUrl: '/games/1',
    headers: {
      'user-agent': 'jest',
      'x-real-ip': '127.0.0.1',
    },
    user: { sub: 'user-1' },
    ...reqOverride,
  }

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost

  return { host, status, json }
}

describe('AllExceptionsFilter', () => {
  let i18n: jest.Mocked<Pick<I18nService, 't'>>
  let logger: jest.Mocked<Pick<Logger, 'error' | 'warn'>>
  let filter: AllExceptionsFilter

  beforeEach(() => {
    i18n = { t: jest.fn((key: string) => `t:${key}` as any) }
    logger = { error: jest.fn(), warn: jest.fn() }
    filter = new AllExceptionsFilter(i18n as unknown as I18nService, logger as unknown as Logger)
    jest.spyOn(I18nContext, 'current').mockReturnValue({ lang: 'zh-CN' } as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('formats i18n validation exception and responds with validation payload', () => {
    const { host, status, json } = createHost()
    const exception = new I18nValidationException([
      {
        property: 'email',
        constraints: {
          isNotEmpty: 'email.required',
        },
      } as any,
    ])

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
    const body = json.mock.calls[0][0]
    expect(body.code).toBe(ShionBizCode.COMMON_VALIDATION_FAILED)
    expect(body.message).toBe('t:shion-biz.COMMON_VALIDATION_FAILED')
    expect(body.data).toEqual({
      errors: [{ field: 'email', messages: ['fmt:email.required'] }],
    })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('uses custom errors for business exception payload', () => {
    const { host, status, json } = createHost()
    const exception = new ShionBizException(
      ShionBizCode.USER_NOT_FOUND,
      undefined,
      {
        errors: [{ field: 'name', messages: ['name.invalid'] }],
      },
      undefined,
      [{ field: 'name', messages: ['not-found'] }],
    )

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
    const body = json.mock.calls[0][0]
    expect(body.code).toBe(ShionBizCode.USER_NOT_FOUND)
    expect(body.message).toBe('t:shion-biz.USER_NOT_FOUND')
    expect(body.data).toEqual({
      errors: [{ field: 'name', messages: ['not-found'] }],
    })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('maps HttpException status and skips warn for 401', () => {
    const { host, status, json } = createHost()
    const exception = new HttpException('unauthorized', HttpStatus.UNAUTHORIZED)

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED)
    const body = json.mock.calls[0][0]
    expect(body.code).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe('t:http.401')
    expect(body.data).toBeNull()
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('logs error for unknown exception and returns internal server error', () => {
    const { host, status, json } = createHost()
    const exception = new Error('boom')

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    const body = json.mock.calls[0][0]
    expect(body.code).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body.message).toBe('t:common.error')
    expect(body.data).toBeNull()
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
