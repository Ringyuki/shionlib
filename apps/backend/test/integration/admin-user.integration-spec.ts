import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { AdminUserController } from '../../src/modules/admin/controllers/admin-user.controller'
import { AdminUserService } from '../../src/modules/admin/services/admin-user.service'
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard'

describe('AdminUser (integration)', () => {
  let app: INestApplication

  const adminUserService = {
    getUserList: jest.fn(),
    getUserDetail: jest.fn(),
    updateUserProfile: jest.fn(),
    updateUserRole: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
    resetPassword: jest.fn(),
    forceLogout: jest.fn(),
    getUserSessions: jest.fn(),
    getUserEditPermissions: jest.fn(),
    updateUserEditPermissions: jest.fn(),
    adjustUserUploadQuotaSize: jest.fn(),
    adjustUserUploadQuotaUsed: jest.fn(),
    resetUserUploadQuotaUsed: jest.fn(),
  }
  const jwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 9001, role: 99, fid: 'admin-family' }
      return true
    }),
  }
  const rolesGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  }

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AdminUserController],
      providers: [{ provide: AdminUserService, useValue: adminUserService }],
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

  it('covers user list/detail and profile/role update', async () => {
    adminUserService.getUserList.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    adminUserService.getUserDetail.mockResolvedValueOnce({ id: 7 })
    adminUserService.updateUserProfile.mockResolvedValueOnce({ id: 7, updated: true })
    adminUserService.updateUserRole.mockResolvedValueOnce({ id: 7, role: 2 })

    const listRes = await request(app.getHttpServer())
      .get('/admin/users')
      .query({ page: 2, pageSize: 20, search: 'foo' })
      .expect(200)
    expect(listRes.headers['shionlib-request-id']).toBeDefined()
    expect(adminUserService.getUserList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2', pageSize: '20', search: 'foo' }),
    )

    await request(app.getHttpServer()).get('/admin/users/7').expect(200)
    expect(adminUserService.getUserDetail).toHaveBeenCalledWith(7)

    await request(app.getHttpServer())
      .patch('/admin/users/7/profile')
      .send({ name: 'new-name' })
      .expect(200)
    expect(adminUserService.updateUserProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ name: 'new-name' }),
      expect.objectContaining({ sub: 9001 }),
    )

    await request(app.getHttpServer()).patch('/admin/users/7/role').send({ role: 2 }).expect(200)
    expect(adminUserService.updateUserRole).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ role: 2 }),
      expect.objectContaining({ sub: 9001 }),
    )
  })

  it('covers ban/unban/reset-password/force-logout actions', async () => {
    adminUserService.banUser.mockResolvedValueOnce({ ok: true })
    adminUserService.unbanUser.mockResolvedValueOnce({ ok: true })
    adminUserService.resetPassword.mockResolvedValueOnce({ ok: true })
    adminUserService.forceLogout.mockResolvedValueOnce({ ok: true })

    await request(app.getHttpServer())
      .post('/admin/users/8/ban')
      .send({ days: 3, reason: 'spam' })
      .expect(201)
    expect(adminUserService.banUser).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ days: 3, reason: 'spam' }),
      expect.objectContaining({ sub: 9001 }),
    )

    await request(app.getHttpServer()).post('/admin/users/8/unban').expect(201)
    expect(adminUserService.unbanUser).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ sub: 9001 }),
    )

    await request(app.getHttpServer())
      .post('/admin/users/8/reset-password')
      .send({ newPassword: 'new-password-123' })
      .expect(201)
    expect(adminUserService.resetPassword).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ newPassword: 'new-password-123' }),
      expect.objectContaining({ sub: 9001 }),
    )

    await request(app.getHttpServer()).post('/admin/users/8/force-logout').expect(201)
    expect(adminUserService.forceLogout).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ sub: 9001 }),
    )
  })

  it('covers sessions/permissions/quota operations', async () => {
    adminUserService.getUserSessions.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })
    adminUserService.getUserEditPermissions.mockResolvedValueOnce({
      entity: 'game',
      allowBits: [1, 2],
    })
    adminUserService.updateUserEditPermissions.mockResolvedValueOnce({ updated: true })
    adminUserService.adjustUserUploadQuotaSize.mockResolvedValueOnce({ size: 1024 })
    adminUserService.adjustUserUploadQuotaUsed.mockResolvedValueOnce({ used: 256 })
    adminUserService.resetUserUploadQuotaUsed.mockResolvedValueOnce({ used: 0 })

    await request(app.getHttpServer())
      .get('/admin/users/9/sessions')
      .query({ page: 1, pageSize: 5 })
      .expect(200)
    expect(adminUserService.getUserSessions).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ page: '1', pageSize: '5' }),
    )

    await request(app.getHttpServer())
      .get('/admin/users/9/permissions')
      .query({ entity: 'game' })
      .expect(200)
    expect(adminUserService.getUserEditPermissions).toHaveBeenCalledWith(
      9,
      'game',
      expect.objectContaining({ sub: 9001 }),
    )

    await request(app.getHttpServer())
      .patch('/admin/users/9/permissions')
      .send({ entity: 'game', allowBits: [4, 8] })
      .expect(200)
    expect(adminUserService.updateUserEditPermissions).toHaveBeenCalledWith(
      9,
      'game',
      [4, 8],
      expect.objectContaining({ sub: 9001 }),
    )

    await request(app.getHttpServer())
      .patch('/admin/users/9/quota/size')
      .send({ sizeMb: 2048 })
      .expect(200)
    expect(adminUserService.adjustUserUploadQuotaSize).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ sizeMb: 2048 }),
      expect.objectContaining({ sub: 9001 }),
    )

    await request(app.getHttpServer())
      .patch('/admin/users/9/quota/used')
      .send({ usedMb: 300 })
      .expect(200)
    expect(adminUserService.adjustUserUploadQuotaUsed).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ usedMb: 300 }),
      expect.objectContaining({ sub: 9001 }),
    )

    await request(app.getHttpServer()).post('/admin/users/9/quota/reset-used').expect(201)
    expect(adminUserService.resetUserUploadQuotaUsed).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ sub: 9001 }),
    )
  })

  it('returns 400 for invalid id path params', async () => {
    await request(app.getHttpServer()).get('/admin/users/not-a-number').expect(400)
    await request(app.getHttpServer())
      .patch('/admin/users/not-a-number/profile')
      .send({})
      .expect(400)
    await request(app.getHttpServer())
      .patch('/admin/users/not-a-number/role')
      .send({ role: 2 })
      .expect(400)
    await request(app.getHttpServer()).post('/admin/users/not-a-number/ban').send({}).expect(400)
    await request(app.getHttpServer()).post('/admin/users/not-a-number/unban').expect(400)
    await request(app.getHttpServer())
      .post('/admin/users/not-a-number/reset-password')
      .send({ newPassword: 'x' })
      .expect(400)
    await request(app.getHttpServer()).post('/admin/users/not-a-number/force-logout').expect(400)
    await request(app.getHttpServer()).get('/admin/users/not-a-number/sessions').expect(400)
    await request(app.getHttpServer())
      .get('/admin/users/not-a-number/permissions')
      .query({ entity: 'game' })
      .expect(400)
    await request(app.getHttpServer())
      .patch('/admin/users/not-a-number/permissions')
      .send({ entity: 'game', allowBits: [1] })
      .expect(400)
    await request(app.getHttpServer())
      .patch('/admin/users/not-a-number/quota/size')
      .send({ sizeMb: 1 })
      .expect(400)
    await request(app.getHttpServer())
      .patch('/admin/users/not-a-number/quota/used')
      .send({ usedMb: 1 })
      .expect(400)
    await request(app.getHttpServer())
      .post('/admin/users/not-a-number/quota/reset-used')
      .expect(400)
  })

  it('returns 403 when role guard denies access', async () => {
    ;(rolesGuard.canActivate as jest.Mock).mockReturnValueOnce(false)

    const res = await request(app.getHttpServer()).get('/admin/users').expect(403)

    expect(res.body.message).toBe('Forbidden resource')
    expect(adminUserService.getUserList).not.toHaveBeenCalled()
  })
})
