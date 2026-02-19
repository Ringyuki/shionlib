import { BadRequestException, Controller, Get, INestApplication, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { SuccessResponseInterceptor } from '../../src/common/interceptors/success-response.interceptor'
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { ShionBizException } from '../../src/common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../src/shared/enums/biz-code/shion-biz-code.enum'

@Controller('pipeline')
class PipelineController {
  @Get('ok')
  ok() {
    return { hello: 'world' }
  }

  @Get('stale-auth')
  staleAuth() {
    return { ok: true }
  }

  @Get('biz-error')
  bizError() {
    throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND, 'shion-biz.GAME_NOT_FOUND')
  }

  @Get('http-error')
  httpError() {
    throw new BadRequestException('invalid request')
  }

  @Get('crash')
  crash() {
    throw new Error('boom')
  }
}

describe('HTTP Pipeline (integration)', () => {
  let app: INestApplication
  const i18n = {
    t: jest.fn((key: string) => key),
  }
  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PipelineController],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(requestId())
    app.use((req: any, _res: any, next: () => void) => {
      if (req.url === '/pipeline/stale-auth') {
        req.auth = { optionalTokenStale: true, optionalTokenReason: 'expired' }
      }
      next()
    })
    app.useGlobalInterceptors(new SuccessResponseInterceptor(new Reflector(), i18n as any))
    app.useGlobalFilters(new AllExceptionsFilter(i18n as any, logger as unknown as Logger))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('wraps success responses and appends request id', async () => {
    const res = await request(app.getHttpServer()).get('/pipeline/ok').expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body.code).toBe(ShionBizCode.COMMON_SUCCESS)
    expect(res.body.message).toBe('common.success')
    expect(res.body.data).toEqual({ hello: 'world' })
    expect(typeof res.body.requestId).toBe('string')
    expect(typeof res.body.timestamp).toBe('string')
  })

  it('sets stale auth header and meta when optional token is stale', async () => {
    const res = await request(app.getHttpServer()).get('/pipeline/stale-auth').expect(200)

    expect(res.headers['shionlib-auth-stale']).toBe('1')
    expect(res.body.meta).toEqual({
      auth: {
        optionalTokenStale: true,
        optionalTokenReason: 'expired',
      },
    })
  })

  it('formats ShionBizException using business code and status mapping', async () => {
    const res = await request(app.getHttpServer()).get('/pipeline/biz-error').expect(404)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body.code).toBe(ShionBizCode.GAME_NOT_FOUND)
    expect(res.body.message).toBe('shion-biz.GAME_NOT_FOUND')
    expect(res.body.data).toBeNull()
    expect(typeof res.body.requestId).toBe('string')
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('formats HttpException as http status key', async () => {
    const res = await request(app.getHttpServer()).get('/pipeline/http-error').expect(400)

    expect(res.body.code).toBe(400)
    expect(res.body.message).toBe('http.400')
    expect(res.body.data).toBeNull()
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('handles unknown errors as 500 and logs at error level', async () => {
    const res = await request(app.getHttpServer()).get('/pipeline/crash').expect(500)

    expect(res.body.code).toBe(500)
    expect(res.body.message).toBe('common.error')
    expect(res.body.data).toBeNull()
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
