import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { SmallFileUploadController } from '../../src/modules/upload/controllers/small-file-upload.controller'
import { SmallFileUploadService } from '../../src/modules/upload/services/small-file-upload.service'

describe('SmallFileUpload (integration)', () => {
  let app: INestApplication

  const smallFileUploadService = {
    uploadGameCover: jest.fn(),
    uploadGameImage: jest.fn(),
    uploadDeveloperLogo: jest.fn(),
    uploadCharacterImage: jest.fn(),
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
      controllers: [SmallFileUploadController],
      providers: [{ provide: SmallFileUploadService, useValue: smallFileUploadService }],
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

  it('covers all small upload routes with supported image mimetypes', async () => {
    smallFileUploadService.uploadGameCover.mockResolvedValueOnce({ id: 1 })
    smallFileUploadService.uploadGameImage.mockResolvedValueOnce({ id: 2 })
    smallFileUploadService.uploadDeveloperLogo.mockResolvedValueOnce({ id: 3 })
    smallFileUploadService.uploadCharacterImage.mockResolvedValueOnce({ id: 4 })

    const gameCoverRes = await request(app.getHttpServer())
      .put('/uploads/small/game/10/cover')
      .attach('file', Buffer.from('png-file'), { filename: 'cover.png', contentType: 'image/png' })
      .expect(200)
    expect(gameCoverRes.headers['shionlib-request-id']).toBeDefined()

    await request(app.getHttpServer())
      .put('/uploads/small/game/11/image')
      .attach('file', Buffer.from('jpeg-file'), {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200)

    await request(app.getHttpServer())
      .put('/uploads/small/developer/12/logo')
      .attach('file', Buffer.from('webp-file'), {
        filename: 'logo.webp',
        contentType: 'image/webp',
      })
      .expect(200)

    await request(app.getHttpServer())
      .put('/uploads/small/character/13/image')
      .attach('file', Buffer.from('avif-file'), {
        filename: 'char.avif',
        contentType: 'image/avif',
      })
      .expect(200)

    expect(smallFileUploadService.uploadGameCover).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ originalname: 'cover.png', mimetype: 'image/png' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(smallFileUploadService.uploadGameImage).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ originalname: 'image.jpg', mimetype: 'image/jpeg' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(smallFileUploadService.uploadDeveloperLogo).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ originalname: 'logo.webp', mimetype: 'image/webp' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(smallFileUploadService.uploadCharacterImage).toHaveBeenCalledWith(
      13,
      expect.objectContaining({ originalname: 'char.avif', mimetype: 'image/avif' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
  })

  it('returns 415 when file type is not supported', async () => {
    const res = await request(app.getHttpServer())
      .put('/uploads/small/game/10/cover')
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'bad.pdf',
        contentType: 'application/pdf',
      })
      .expect(415)

    expect(res.body.statusCode).toBe(415)
    expect(smallFileUploadService.uploadGameCover).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer())
      .put('/uploads/small/game/not-a-number/cover')
      .attach('file', Buffer.from('png-file'), { filename: 'cover.png', contentType: 'image/png' })
      .expect(400)
    await request(app.getHttpServer())
      .put('/uploads/small/game/not-a-number/image')
      .attach('file', Buffer.from('png-file'), { filename: 'image.png', contentType: 'image/png' })
      .expect(400)
    await request(app.getHttpServer())
      .put('/uploads/small/developer/not-a-number/logo')
      .attach('file', Buffer.from('png-file'), { filename: 'logo.png', contentType: 'image/png' })
      .expect(400)
    await request(app.getHttpServer())
      .put('/uploads/small/character/not-a-number/image')
      .attach('file', Buffer.from('png-file'), { filename: 'char.png', contentType: 'image/png' })
      .expect(400)

    expect(smallFileUploadService.uploadGameCover).not.toHaveBeenCalled()
    expect(smallFileUploadService.uploadGameImage).not.toHaveBeenCalled()
    expect(smallFileUploadService.uploadDeveloperLogo).not.toHaveBeenCalled()
    expect(smallFileUploadService.uploadCharacterImage).not.toHaveBeenCalled()
  })

  it('returns 403 when jwt guard denies upload request', async () => {
    ;(jwtAuthGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer())
      .put('/uploads/small/game/10/cover')
      .attach('file', Buffer.from('png-file'), { filename: 'cover.png', contentType: 'image/png' })
      .expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(smallFileUploadService.uploadGameCover).not.toHaveBeenCalled()
  })
})
