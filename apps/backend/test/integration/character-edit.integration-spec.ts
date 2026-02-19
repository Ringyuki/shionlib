import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { CharacterEditController } from '../../src/modules/character/controllers/character-edit.controller'
import { CharacterEditService } from '../../src/modules/character/services/character-edit.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { PermissionService } from '../../src/modules/edit/services/permission.service'

describe('CharacterEdit (integration)', () => {
  let app: INestApplication

  const characterEditService = {
    editCharacterScalar: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
      return true
    }),
  }
  const permissionService = {
    getAllowMaskFor: jest.fn(async () => (1n << 62n) - 1n),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [CharacterEditController],
      providers: [
        { provide: CharacterEditService, useValue: characterEditService },
        { provide: PermissionService, useValue: permissionService },
      ],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(jwtAuthGuard)
    const moduleFixture: TestingModule = await moduleBuilder.compile()

    app = moduleFixture.createNestApplication()
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { sub: 9001, role: 0, fid: 'family-1' }
      next()
    })
    app.use(requestId())
    await app.init()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('PATCH /character/:id/edit/scalar forwards dto and request', async () => {
    characterEditService.editCharacterScalar.mockResolvedValueOnce({ id: 5, updated: true })

    const res = await request(app.getHttpServer())
      .patch('/character/5/edit/scalar')
      .send({ name_zh: 'new-char-zh' })
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.body).toEqual({ id: 5, updated: true })
    expect(characterEditService.editCharacterScalar).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ name_zh: 'new-char-zh' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
  })

  it('returns 400 for invalid id param', async () => {
    await request(app.getHttpServer())
      .patch('/character/not-a-number/edit/scalar')
      .send({ name_zh: 'x' })
      .expect(400)

    expect(characterEditService.editCharacterScalar).not.toHaveBeenCalled()
  })

  it('returns 403 when edit permission guard denies', async () => {
    permissionService.getAllowMaskFor.mockResolvedValueOnce(0n)

    const res = await request(app.getHttpServer())
      .patch('/character/5/edit/scalar')
      .send({ name_zh: 'x' })
      .expect(403)

    expect(res.body.statusCode).toBe(403)
    expect(characterEditService.editCharacterScalar).not.toHaveBeenCalled()
  })
})
