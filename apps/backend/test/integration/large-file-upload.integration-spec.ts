import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { LargeFileUploadController } from '../../src/modules/upload/controllers/large-file-upload.controller'
import { LargeFileUploadService } from '../../src/modules/upload/services/large-file-upload.service'

describe('LargeFileUpload (integration)', () => {
  let app: INestApplication

  const largeFileUploadService = {
    getOngoingSessions: jest.fn(),
    init: jest.fn(),
    writeChunk: jest.fn(),
    status: jest.fn(),
    complete: jest.fn(),
    abort: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
      return true
    }),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [LargeFileUploadController],
      providers: [{ provide: LargeFileUploadService, useValue: largeFileUploadService }],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
    const moduleFixture: TestingModule = await moduleBuilder.compile()

    app = moduleFixture.createNestApplication()
    app.use(requestId())
    await app.init()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('covers ongoing/init/chunk/status/complete/abort endpoints', async () => {
    largeFileUploadService.getOngoingSessions.mockResolvedValueOnce([{ id: 1 }])
    largeFileUploadService.init.mockResolvedValueOnce({
      upload_session_id: 1,
      chunk_size: 3,
      total_chunks: 1,
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    largeFileUploadService.writeChunk.mockResolvedValueOnce({ ok: true, chunk_index: 3 })
    largeFileUploadService.status.mockResolvedValueOnce({ status: 'UPLOADING' })
    largeFileUploadService.complete.mockResolvedValueOnce({ ok: true })
    largeFileUploadService.abort.mockResolvedValueOnce({ ok: true })

    const ongoingRes = await request(app.getHttpServer()).get('/uploads/large/ongoing').expect(200)
    expect(ongoingRes.headers['shionlib-request-id']).toBeDefined()
    expect(ongoingRes.body).toEqual([{ id: 1 }])

    await request(app.getHttpServer())
      .post('/uploads/large/init')
      .send({ file_name: 'game.bin', total_size: 3, file_sha256: 'file-sha-1' })
      .expect(201)
    expect(largeFileUploadService.init).toHaveBeenCalledWith(
      expect.objectContaining({ file_name: 'game.bin', total_size: 3, file_sha256: 'file-sha-1' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer())
      .put('/uploads/large/8/chunks/3')
      .set('chunk-sha256', 'chunk-sha-1')
      .set('content-length', '3')
      .send('abc')
      .expect(200)
    expect(largeFileUploadService.writeChunk).toHaveBeenCalledWith(
      8,
      3,
      'chunk-sha-1',
      expect.any(Object),
      3,
    )

    await request(app.getHttpServer()).get('/uploads/large/8/status').expect(200)
    expect(largeFileUploadService.status).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).patch('/uploads/large/8/complete').expect(200)
    expect(largeFileUploadService.complete).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )

    await request(app.getHttpServer()).delete('/uploads/large/8').expect(200)
    expect(largeFileUploadService.abort).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
  })

  it('returns 400 for invalid id/index path params', async () => {
    await request(app.getHttpServer())
      .put('/uploads/large/not-a-number/chunks/1')
      .send('x')
      .expect(400)
    await request(app.getHttpServer())
      .put('/uploads/large/1/chunks/not-a-number')
      .send('x')
      .expect(400)
    await request(app.getHttpServer()).get('/uploads/large/not-a-number/status').expect(400)
    await request(app.getHttpServer()).patch('/uploads/large/not-a-number/complete').expect(400)
    await request(app.getHttpServer()).delete('/uploads/large/not-a-number').expect(400)

    expect(largeFileUploadService.writeChunk).not.toHaveBeenCalled()
    expect(largeFileUploadService.status).not.toHaveBeenCalled()
    expect(largeFileUploadService.complete).not.toHaveBeenCalled()
    expect(largeFileUploadService.abort).not.toHaveBeenCalled()
  })

  it('returns 403 when jwt guard denies endpoint', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).get('/uploads/large/ongoing').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(largeFileUploadService.getOngoingSessions).not.toHaveBeenCalled()
  })
})
