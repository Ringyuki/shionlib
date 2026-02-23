import { HttpStatus } from '@nestjs/common'
import { of } from 'rxjs'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PvnApiService } from './pvn-api.service'

describe('PvnApiService', () => {
  const createService = () => {
    const prisma = {
      userPvnBinding: { findUnique: jest.fn() },
    }
    const httpService = {
      get: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      put: jest.fn(),
      post: jest.fn(),
    }
    const configService = {
      get: jest.fn().mockReturnValue('https://pvn.example'),
    }
    const service = new PvnApiService(prisma as any, httpService as any, configService as any)
    return { service, prisma, httpService }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('token fetching', () => {
    it('throws PVN_BINDING_NOT_FOUND when no binding exists', async () => {
      const { service, prisma } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue(null)

      const err: any = await service.get(1, '/test').catch(e => e)
      expect(err.code).toBe(ShionBizCode.PVN_BINDING_NOT_FOUND)
      expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND)
    })
  })

  describe('get', () => {
    it('calls GET with Bearer token and returns data', async () => {
      const { service, prisma, httpService } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue({ pvn_token: 'tok' })
      httpService.get.mockReturnValue(of({ data: { items: [] } }))

      const result = await service.get(1, '/galgame', { page: 0 })

      expect(httpService.get).toHaveBeenCalledWith('https://pvn.example/galgame', {
        headers: { Authorization: 'Bearer tok' },
        params: { page: 0 },
      })
      expect(result).toEqual({ items: [] })
    })
  })

  describe('patch', () => {
    it('calls PATCH with Bearer token and returns data', async () => {
      const { service, prisma, httpService } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue({ pvn_token: 'tok' })
      httpService.patch.mockReturnValue(of({ data: { id: 1 } }))

      const result = await service.patch(1, '/galgame', { name: 'Test' })

      expect(httpService.patch).toHaveBeenCalledWith(
        'https://pvn.example/galgame',
        { name: 'Test' },
        { headers: { Authorization: 'Bearer tok' } },
      )
      expect(result).toEqual({ id: 1 })
    })
  })

  describe('delete', () => {
    it('calls DELETE with Bearer token', async () => {
      const { service, prisma, httpService } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue({ pvn_token: 'tok' })
      httpService.delete.mockReturnValue(of({ data: undefined }))

      await service.delete(1, '/galgame/42')

      expect(httpService.delete).toHaveBeenCalledWith('https://pvn.example/galgame/42', {
        headers: { Authorization: 'Bearer tok' },
      })
    })
  })

  describe('put', () => {
    it('calls PUT with Bearer token and query params', async () => {
      const { service, prisma, httpService } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue({ pvn_token: 'tok' })
      httpService.put.mockReturnValue(of({ data: undefined }))

      await service.put(1, '/oss/update', { objectFullName: 'foo.webp' })

      expect(httpService.put).toHaveBeenCalledWith('https://pvn.example/oss/update', null, {
        headers: { Authorization: 'Bearer tok' },
        params: { objectFullName: 'foo.webp' },
      })
    })
  })

  describe('postPublic', () => {
    it('calls POST without Authorization header', async () => {
      const { service, httpService } = createService()
      httpService.post.mockReturnValue(of({ data: { token: 'abc', expire: 9999, user: {} } }))

      const result = await service.postPublic('/user/session', { userName: 'u', password: 'p' })

      expect(httpService.post).toHaveBeenCalledWith('https://pvn.example/user/session', {
        userName: 'u',
        password: 'p',
      })
      expect(result).toMatchObject({ token: 'abc' })
    })
  })

  describe('putRaw', () => {
    it('PUTs buffer to external URL without PVN auth', async () => {
      const { service, httpService } = createService()
      httpService.put.mockReturnValue(of({ data: undefined }))
      const buffer = Buffer.from('img')

      await service.putRaw('https://s3.pvn.example/presigned', buffer, 'image/webp')

      expect(httpService.put).toHaveBeenCalledWith('https://s3.pvn.example/presigned', buffer, {
        headers: { 'Content-Type': 'image/webp' },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
    })
  })
})
