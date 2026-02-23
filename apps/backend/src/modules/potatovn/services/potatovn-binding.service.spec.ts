import { HttpStatus } from '@nestjs/common'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PotatoVNBindingService } from './potatovn-binding.service'

const mockPvnLoginResponse = {
  user: { id: 42, userName: 'yuki' },
  token: 'pvn-token',
  expire: 9999999999,
}

describe('PotatoVNBindingService', () => {
  const createService = () => {
    const prisma = {
      userPvnBinding: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userGamePvnMapping: {
        deleteMany: jest.fn(),
      },
    }
    const pvnApi = {
      postPublic: jest.fn(),
      get: jest.fn(),
    }
    const gameMappingService = {
      syncLibrary: jest.fn().mockResolvedValue(undefined),
    }
    const service = new PotatoVNBindingService(
      prisma as any,
      pvnApi as any,
      gameMappingService as any,
    )
    return { service, prisma, pvnApi, gameMappingService }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getBinding', () => {
    it('returns binding when found', async () => {
      const { service, prisma } = createService()
      const binding = {
        pvn_user_id: 42,
        pvn_user_name: 'yuki',
        pvn_user_avatar: null,
        pvn_token_expires: new Date(),
        created: new Date(),
        updated: new Date(),
      }
      prisma.userPvnBinding.findUnique.mockResolvedValue(binding)

      expect(await service.getBinding(10)).toEqual(binding)
    })

    it('throws PVN_BINDING_NOT_FOUND when not found', async () => {
      const { service, prisma } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue(null)

      const err = await service.getBinding(10).catch(e => e)
      expect(err.code).toBe(ShionBizCode.PVN_BINDING_NOT_FOUND)
      expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND)
    })
  })

  describe('bind', () => {
    it('throws PVN_BINDING_ALREADY_EXISTS when binding already exists', async () => {
      const { service, prisma } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue({ id: 1 })

      await expect(
        service.bind(10, { pvn_user_name: 'u', pvn_password: 'p' }),
      ).rejects.toMatchObject({ code: ShionBizCode.PVN_BINDING_ALREADY_EXISTS })
    })

    it('logs in, creates binding, and triggers library sync on success', async () => {
      const { service, prisma, pvnApi, gameMappingService } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue(null)
      pvnApi.postPublic.mockResolvedValue(mockPvnLoginResponse)
      const created = {
        pvn_user_id: 42,
        pvn_user_name: 'yuki',
        pvn_user_avatar: null,
        pvn_token_expires: new Date(),
        created: new Date(),
        updated: new Date(),
      }
      prisma.userPvnBinding.create.mockResolvedValue(created)

      const result = await service.bind(10, { pvn_user_name: 'yuki', pvn_password: 'pass' })

      expect(pvnApi.postPublic).toHaveBeenCalledWith('/user/session', {
        userName: 'yuki',
        password: 'pass',
      })
      expect(prisma.userPvnBinding.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 10,
            pvn_user_id: 42,
            pvn_user_name: 'yuki',
            pvn_token: 'pvn-token',
          }),
        }),
      )
      expect(result).toEqual(created)
      // syncLibrary is fire-and-forget; just verify it was called
      expect(gameMappingService.syncLibrary).toHaveBeenCalledWith(10)
    })

    it('throws PVN_BINDING_AUTH_FAILED when login fails', async () => {
      const { service, prisma, pvnApi } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue(null)
      pvnApi.postPublic.mockRejectedValue(new Error('Unauthorized'))

      const err = await service.bind(10, { pvn_user_name: 'u', pvn_password: 'bad' }).catch(e => e)
      expect(err.code).toBe(ShionBizCode.PVN_BINDING_AUTH_FAILED)
      expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
    })
  })

  describe('unbind', () => {
    it('throws PVN_BINDING_NOT_FOUND when not bound', async () => {
      const { service, prisma } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue(null)

      await expect(service.unbind(10)).rejects.toMatchObject({
        code: ShionBizCode.PVN_BINDING_NOT_FOUND,
      })
    })

    it('deletes binding and all game mappings', async () => {
      const { service, prisma } = createService()
      prisma.userPvnBinding.findUnique.mockResolvedValue({ id: 1 })
      prisma.userPvnBinding.delete.mockResolvedValue(undefined)
      prisma.userGamePvnMapping.deleteMany.mockResolvedValue(undefined)

      await service.unbind(10)

      expect(prisma.userPvnBinding.delete).toHaveBeenCalledWith({ where: { user_id: 10 } })
      expect(prisma.userGamePvnMapping.deleteMany).toHaveBeenCalledWith({ where: { user_id: 10 } })
    })
  })

  describe('refreshToken', () => {
    it('calls pvnApi.get with userId and updates stored token on success', async () => {
      const { service, prisma, pvnApi } = createService()
      pvnApi.get.mockResolvedValue(mockPvnLoginResponse)
      prisma.userPvnBinding.update.mockResolvedValue(undefined)

      await service.refreshToken(10)

      expect(pvnApi.get).toHaveBeenCalledWith(10, '/user/session/refresh')
      expect(prisma.userPvnBinding.update).toHaveBeenCalledWith({
        where: { user_id: 10 },
        data: expect.objectContaining({ pvn_token: 'pvn-token' }),
      })
    })

    it('throws PVN_BINDING_AUTH_FAILED when refresh call fails', async () => {
      const { service, pvnApi } = createService()
      pvnApi.get.mockRejectedValue(new Error('401'))

      const err = await service.refreshToken(10).catch(e => e)
      expect(err.code).toBe(ShionBizCode.PVN_BINDING_AUTH_FAILED)
      expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
    })
  })
})
