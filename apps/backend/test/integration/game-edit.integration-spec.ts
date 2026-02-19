import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { PermissionService } from '../../src/modules/edit/services/permission.service'
import { GameEditController } from '../../src/modules/game/controllers/game-edit.controller'
import { GameEditService } from '../../src/modules/game/services/game-edit.service'

describe('GameEdit (integration)', () => {
  let app: INestApplication

  const gameEditService = {
    editGameScalar: jest.fn(),
    editLinks: jest.fn(),
    addLinks: jest.fn(),
    removeLinks: jest.fn(),
    editCovers: jest.fn(),
    editCover: jest.fn(),
    addCovers: jest.fn(),
    removeCovers: jest.fn(),
    editImages: jest.fn(),
    editImage: jest.fn(),
    addImages: jest.fn(),
    removeImages: jest.fn(),
    addDevelopers: jest.fn(),
    removeDevelopers: jest.fn(),
    editDevelopers: jest.fn(),
    addCharacters: jest.fn(),
    removeCharacters: jest.fn(),
    editCharacters: jest.fn(),
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
      controllers: [GameEditController],
      providers: [
        { provide: GameEditService, useValue: gameEditService },
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

  it('covers scalar/link/cover/image/developer/character edit routes', async () => {
    gameEditService.editGameScalar.mockResolvedValueOnce({ id: 5, updated: true })
    gameEditService.editLinks.mockResolvedValueOnce({ edited: 1 })
    gameEditService.addLinks.mockResolvedValueOnce({ created: 1 })
    gameEditService.removeLinks.mockResolvedValueOnce({ deleted: 1 })
    gameEditService.editCovers.mockResolvedValueOnce({ edited: 1 })
    gameEditService.editCover.mockResolvedValueOnce({ edited: true })
    gameEditService.addCovers.mockResolvedValueOnce({ created: 1 })
    gameEditService.removeCovers.mockResolvedValueOnce({ deleted: 1 })
    gameEditService.editImages.mockResolvedValueOnce({ edited: 1 })
    gameEditService.editImage.mockResolvedValueOnce({ edited: true })
    gameEditService.addImages.mockResolvedValueOnce({ created: 1 })
    gameEditService.removeImages.mockResolvedValueOnce({ deleted: 1 })
    gameEditService.addDevelopers.mockResolvedValueOnce({ created: 1 })
    gameEditService.removeDevelopers.mockResolvedValueOnce({ deleted: 1 })
    gameEditService.editDevelopers.mockResolvedValueOnce({ edited: 1 })
    gameEditService.addCharacters.mockResolvedValueOnce({ created: 1 })
    gameEditService.removeCharacters.mockResolvedValueOnce({ deleted: 1 })
    gameEditService.editCharacters.mockResolvedValueOnce({ edited: 1 })

    const scalarRes = await request(app.getHttpServer())
      .patch('/game/5/edit/scalar')
      .send({ title_zh: 'new title' })
      .expect(200)
    expect(scalarRes.headers['shionlib-request-id']).toBeDefined()

    await request(app.getHttpServer())
      .patch('/game/5/edit/links')
      .send({ links: [{ id: 1, label: 'homepage' }] })
      .expect(200)
    await request(app.getHttpServer())
      .put('/game/5/edit/links')
      .send({ links: [{ label: 'steam', url: 'https://store.steampowered.com' }] })
      .expect(200)
    await request(app.getHttpServer())
      .delete('/game/5/edit/links')
      .send({ ids: [1] })
      .expect(200)

    await request(app.getHttpServer())
      .patch('/game/5/edit/covers')
      .send({ covers: [{ id: 10, url: 'https://img/cover-a.jpg' }] })
      .expect(200)
    await request(app.getHttpServer())
      .patch('/game/5/edit/cover')
      .send({ id: 10, url: 'https://img/cover-b.jpg' })
      .expect(200)
    await request(app.getHttpServer())
      .put('/game/5/edit/covers')
      .send({ covers: [{ url: 'https://img/cover-c.jpg' }] })
      .expect(200)
    await request(app.getHttpServer())
      .delete('/game/5/edit/covers')
      .send({ ids: [10] })
      .expect(200)

    await request(app.getHttpServer())
      .patch('/game/5/edit/images')
      .send({ images: [{ id: 20, url: 'https://img/image-a.jpg' }] })
      .expect(200)
    await request(app.getHttpServer())
      .patch('/game/5/edit/image')
      .send({ id: 20, url: 'https://img/image-b.jpg' })
      .expect(200)
    await request(app.getHttpServer())
      .put('/game/5/edit/images')
      .send({ images: [{ url: 'https://img/image-c.jpg' }] })
      .expect(200)
    await request(app.getHttpServer())
      .delete('/game/5/edit/images')
      .send({ ids: [20] })
      .expect(200)

    await request(app.getHttpServer())
      .put('/game/5/edit/developers')
      .send({ developers: [{ developer_id: 2, role: 'developer' }] })
      .expect(200)
    await request(app.getHttpServer())
      .patch('/game/5/edit/developers')
      .send({ developers: [{ id: 30, role: 'publisher' }] })
      .expect(200)
    await request(app.getHttpServer())
      .delete('/game/5/edit/developers')
      .send({ ids: [30] })
      .expect(200)

    await request(app.getHttpServer())
      .put('/game/5/edit/characters')
      .send({ characters: [{ character_id: 8, role: 'main' }] })
      .expect(200)
    await request(app.getHttpServer())
      .patch('/game/5/edit/characters')
      .send({ characters: [{ id: 40, role: 'support' }] })
      .expect(200)
    await request(app.getHttpServer())
      .delete('/game/5/edit/characters')
      .send({ ids: [40] })
      .expect(200)

    expect(gameEditService.editGameScalar).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ title_zh: 'new title' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.editLinks).toHaveBeenCalledWith(
      5,
      [{ id: 1, label: 'homepage' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.addLinks).toHaveBeenCalledWith(
      5,
      [{ label: 'steam', url: 'https://store.steampowered.com' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.removeLinks).toHaveBeenCalledWith(
      5,
      [1],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.editCovers).toHaveBeenCalledWith(
      5,
      [{ id: 10, url: 'https://img/cover-a.jpg' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.editCover).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ id: 10, url: 'https://img/cover-b.jpg' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.addCovers).toHaveBeenCalledWith(
      5,
      [{ url: 'https://img/cover-c.jpg' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.removeCovers).toHaveBeenCalledWith(
      5,
      [10],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.editImages).toHaveBeenCalledWith(
      5,
      [{ id: 20, url: 'https://img/image-a.jpg' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.editImage).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ id: 20, url: 'https://img/image-b.jpg' }),
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.addImages).toHaveBeenCalledWith(
      5,
      [{ url: 'https://img/image-c.jpg' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.removeImages).toHaveBeenCalledWith(
      5,
      [20],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.addDevelopers).toHaveBeenCalledWith(
      5,
      [{ developer_id: 2, role: 'developer' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.editDevelopers).toHaveBeenCalledWith(
      5,
      [{ id: 30, role: 'publisher' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.removeDevelopers).toHaveBeenCalledWith(
      5,
      [30],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.addCharacters).toHaveBeenCalledWith(
      5,
      [{ character_id: 8, role: 'main' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.editCharacters).toHaveBeenCalledWith(
      5,
      [{ id: 40, role: 'support' }],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
    expect(gameEditService.removeCharacters).toHaveBeenCalledWith(
      5,
      [40],
      expect.objectContaining({ user: expect.objectContaining({ sub: 9001 }) }),
    )
  })

  it('returns 400 for invalid id param', async () => {
    await request(app.getHttpServer()).patch('/game/not-a-number/edit/scalar').send({}).expect(400)

    expect(gameEditService.editGameScalar).not.toHaveBeenCalled()
  })

  it('returns 403 when edit permission guard denies', async () => {
    permissionService.getAllowMaskFor.mockResolvedValueOnce(0n)

    const res = await request(app.getHttpServer())
      .patch('/game/5/edit/scalar')
      .send({ title_zh: 'x' })
      .expect(403)

    expect(res.body.statusCode).toBe(403)
    expect(gameEditService.editGameScalar).not.toHaveBeenCalled()
  })
})
