import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { AdminTestController } from '../../src/modules/s3/controllers/admin-test.controller'
import { GAME_STORAGE } from '../../src/modules/s3/constants/s3.constants'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('S3 AdminTest (integration)', () => {
  let app: INestApplication

  const s3Service = {
    getFileList: jest.fn(),
    deleteFile: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 100, fid: 'super-admin-family' }
      return true
    }),
  }
  const rolesGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AdminTestController],
      providers: [{ provide: GAME_STORAGE, useValue: s3Service }],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
    moduleBuilder.overrideGuard(RolesGuard).useValue(rolesGuard)
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

  it('GET /s3/test/file/list and DELETE /s3/test/file dispatch service calls', async () => {
    s3Service.getFileList.mockResolvedValueOnce([{ key: 'a/b/c.txt' }])
    s3Service.deleteFile.mockResolvedValueOnce({ deleted: true })

    const listRes = await request(app.getHttpServer()).get('/s3/test/file/list').expect(200)
    expect(listRes.headers['shionlib-request-id']).toBeDefined()
    expect(listRes.body).toEqual([{ key: 'a/b/c.txt' }])
    expect(s3Service.getFileList).toHaveBeenCalledTimes(1)

    const delRes = await request(app.getHttpServer())
      .delete('/s3/test/file')
      .query({ key: 'a/b/c.txt' })
      .expect(200)
    expect(delRes.body).toEqual({ deleted: true })
    expect(s3Service.deleteFile).toHaveBeenCalledWith('a/b/c.txt')
  })

  it('returns 403 when roles guard denies access', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).get('/s3/test/file/list').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(s3Service.getFileList).not.toHaveBeenCalled()
  })
})
