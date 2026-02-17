import { Injectable, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { AdminUserListReqDto, AdminUserSessionsReqDto } from '../dto/req/user-list.req.dto'
import {
  AdminUpdateUserProfileReqDto,
  AdminUpdateUserRoleReqDto,
} from '../dto/req/user-update.req.dto'
import { AdminResetPasswordReqDto } from '../dto/req/reset-password.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { AdminUserItemResDto } from '../dto/res/admin-user-item.res.dto'
import { AdminUserDetailResDto, AdminUserSessionResDto } from '../dto/res/admin-user-detail.res.dto'
import { Prisma } from '@prisma/client'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { UserLoginSessionStatus } from '../../../shared/enums/auth/user-login-session-status.enum'
import argon2 from 'argon2'
import { LoginSessionService } from '../../auth/services/login-session.service'
import { UserService } from '../../user/services/user.service'
import { BanUserReqDto } from '../../user/dto/req/ban-user.req.dto'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { getFieldsByGroup } from '../../edit/helpers/field-mapper'
import {
  AdminAdjustQuotaSizeReqDto,
  AdminAdjustQuotaUsedReqDto,
} from '../dto/req/user-quota.req.dto'

@Injectable()
export class AdminUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loginSessionService: LoginSessionService,
    private readonly userService: UserService,
  ) {}

  async getUserList(query: AdminUserListReqDto): Promise<PaginatedResult<AdminUserItemResDto>> {
    const { page, pageSize, search, role, status, sortBy = 'id', sortOrder = 'desc' } = query

    const where: Prisma.UserWhereInput = {}

    if (role !== undefined) {
      where.role = role
    }

    if (status !== undefined) {
      where.status = status
    }

    if (search) {
      const numeric = Number(search)
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
      if (!Number.isNaN(numeric)) {
        where.OR.push({ id: numeric })
      }
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          status: true,
          lang: true,
          content_limit: true,
          created: true,
          updated: true,
          last_login_at: true,
          two_factor_enabled: true,
          _count: {
            select: {
              comments: true,
              game_download_resources: true,
              favorites: true,
              edit_records: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ])

    return {
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        email: item.email,
        avatar: item.avatar,
        role: item.role,
        status: item.status,
        lang: item.lang,
        content_limit: item.content_limit,
        created: item.created,
        updated: item.updated,
        last_login_at: item.last_login_at,
        two_factor_enabled: item.two_factor_enabled,
        counts: {
          comments: item._count.comments,
          resources: item._count.game_download_resources,
          favorites: item._count.favorites,
          edits: item._count.edit_records,
        },
      })),
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getUserDetail(id: number): Promise<AdminUserDetailResDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        cover: true,
        role: true,
        status: true,
        lang: true,
        content_limit: true,
        created: true,
        updated: true,
        last_login_at: true,
        two_factor_enabled: true,
        upload_quota: {
          select: {
            size: true,
            used: true,
            is_first_grant: true,
          },
        },
        banned_records: {
          take: 1,
          orderBy: { banned_at: 'desc' },
          select: {
            banned_at: true,
            banned_reason: true,
            banned_duration_days: true,
            is_permanent: true,
            unbanned_at: true,
            banned_by_user: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            game_download_resources: true,
            favorites: true,
            edit_records: true,
          },
        },
      },
    })

    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    const latestBan = user.banned_records[0] ?? null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      cover: user.cover,
      role: user.role,
      status: user.status,
      lang: user.lang,
      content_limit: user.content_limit,
      created: user.created,
      updated: user.updated,
      last_login_at: user.last_login_at,
      two_factor_enabled: user.two_factor_enabled,
      upload_quota: user.upload_quota
        ? {
            size: user.upload_quota.size.toString(),
            used: user.upload_quota.used.toString(),
            is_first_grant: user.upload_quota.is_first_grant,
          }
        : undefined,
      counts: {
        comments: user._count.comments,
        resources: user._count.game_download_resources,
        favorites: user._count.favorites,
        edits: user._count.edit_records,
      },
      latest_ban: latestBan
        ? {
            banned_at: latestBan.banned_at,
            banned_reason: latestBan.banned_reason,
            banned_duration_days: latestBan.banned_duration_days,
            is_permanent: latestBan.is_permanent,
            unbanned_at: latestBan.unbanned_at,
            banned_by: latestBan.banned_by_user ?? null,
          }
        : null,
    }
  }

  async updateUserProfile(
    id: number,
    dto: AdminUpdateUserProfileReqDto,
    actor: RequestWithUser['user'],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, name: true, email: true },
    })

    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    this.assertCanManage(actor, user)

    const data: Prisma.UserUpdateInput = {}

    if (dto.name && dto.name !== user.name) {
      const exists = await this.prisma.user.findUnique({ where: { name: dto.name } })
      if (exists) {
        throw new ShionBizException(
          ShionBizCode.USER_NAME_ALREADY_EXISTS,
          'shion-biz.USER_NAME_ALREADY_EXISTS',
        )
      }
      data.name = dto.name
    }

    if (dto.email && dto.email !== user.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
      if (exists) {
        throw new ShionBizException(
          ShionBizCode.USER_EMAIL_ALREADY_EXISTS,
          'shion-biz.USER_EMAIL_ALREADY_EXISTS',
        )
      }
      data.email = dto.email
    }

    if (dto.lang) {
      data.lang = dto.lang
    }

    if (dto.content_limit !== undefined) {
      data.content_limit = dto.content_limit
    }

    if (Object.keys(data).length === 0) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        lang: true,
        content_limit: true,
      },
    })
  }

  async updateUserRole(id: number, dto: AdminUpdateUserRoleReqDto, actor: RequestWithUser['user']) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    if (actor.sub === id) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }

    if (actor.role !== ShionlibUserRoles.SUPER_ADMIN) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role,
      },
    })
  }

  async banUser(id: number, dto: BanUserReqDto, actor: RequestWithUser['user']) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    if (actor.sub === id) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }

    this.assertCanManage(actor, target)

    await this.userService.ban(id, { ...dto, banned_by: actor.sub })
  }

  async unbanUser(id: number, actor: RequestWithUser['user']) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    if (actor.sub === id) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }

    this.assertCanManage(actor, target)

    await this.userService.unban(id)
  }

  async resetPassword(id: number, dto: AdminResetPasswordReqDto, actor: RequestWithUser['user']) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    if (actor.sub === id) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }

    this.assertCanManage(actor, target)

    const passwordHash = await argon2.hash(dto.password)
    await this.prisma.user.update({
      where: { id },
      data: { password: passwordHash },
    })

    await this.blockUserSessions(id, 'admin_reset_password')
  }

  async forceLogout(id: number, actor: RequestWithUser['user']) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    this.assertCanManage(actor, target)

    await this.blockUserSessions(id, 'admin_force_logout')
  }

  async getUserSessions(
    id: number,
    query: AdminUserSessionsReqDto,
  ): Promise<PaginatedResult<AdminUserSessionResDto>> {
    const { page, pageSize, status } = query
    const where: Prisma.UserLoginSessionWhereInput = {
      user_id: id,
    }
    if (status) {
      where.status = status
    }

    const [items, total] = await Promise.all([
      this.prisma.userLoginSession.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created: 'desc' },
        select: {
          id: true,
          family_id: true,
          status: true,
          ip: true,
          user_agent: true,
          device_info: true,
          created: true,
          updated: true,
          last_used_at: true,
          expires_at: true,
          rotated_at: true,
          reused_at: true,
          blocked_at: true,
          blocked_reason: true,
        },
      }),
      this.prisma.userLoginSession.count({ where }),
    ])

    return {
      items: items.map(item => ({
        id: item.id,
        family_id: item.family_id,
        status: item.status,
        ip: item.ip,
        user_agent: item.user_agent,
        device_info: item.device_info,
        created: item.created,
        updated: item.updated,
        last_used_at: item.last_used_at,
        expires_at: item.expires_at,
        rotated_at: item.rotated_at,
        reused_at: item.reused_at,
        blocked_at: item.blocked_at,
        blocked_reason: item.blocked_reason,
      })),
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getUserEditPermissions(
    id: number,
    entity: PermissionEntity,
    actor: RequestWithUser['user'],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    this.assertCanManage(actor, user)

    const [rolePerm, userPerm, mappings] = await Promise.all([
      this.prisma.roleFieldPermission.findUnique({
        where: { role_entity: { role: user.role, entity } },
      }),
      this.prisma.userFieldPermission.findUnique({
        where: { user_id_entity: { user_id: id, entity } },
      }),
      this.prisma.fieldPermissionMapping.findMany({
        where: { entity },
        orderBy: { bitIndex: 'asc' },
      }),
    ])

    const roleMask = BigInt(rolePerm?.allowMask ?? 0)
    const userMask = BigInt(userPerm?.allowMask ?? 0)
    const allowMask = roleMask | userMask

    const groups = mappings.map(mapping => {
      const bit = mapping.bitIndex
      const bitMask = 1n << BigInt(bit)
      const hasRole = (roleMask & bitMask) !== 0n
      const hasUser = (userMask & bitMask) !== 0n
      const enabled = hasRole || hasUser
      return {
        field: mapping.field,
        bitIndex: mapping.bitIndex,
        isRelation: mapping.isRelation,
        fields: getFieldsByGroup(entity, mapping.field),
        enabled,
        source: hasRole ? 'role' : hasUser ? 'user' : 'none',
        mutable: !hasRole,
      }
    })

    return {
      entity,
      roleMask: roleMask.toString(),
      userMask: userMask.toString(),
      allowMask: allowMask.toString(),
      groups,
    }
  }

  async updateUserEditPermissions(
    id: number,
    entity: PermissionEntity,
    allowBits: number[] | undefined,
    actor: RequestWithUser['user'],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!user) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }

    this.assertCanManage(actor, user)

    const mappings = await this.prisma.fieldPermissionMapping.findMany({
      where: { entity },
      select: { bitIndex: true },
    })
    const validBits = new Set(mappings.map(m => m.bitIndex))
    const bits = allowBits ?? []
    const invalidBits = bits.filter(bit => !validBits.has(bit))
    if (invalidBits.length > 0) {
      throw new ShionBizException(
        ShionBizCode.COMMON_VALIDATION_FAILED,
        'shion-biz.COMMON_VALIDATION_FAILED',
        { invalidBits },
        HttpStatus.BAD_REQUEST,
      )
    }

    let mask = 0n
    for (const bit of bits) {
      mask |= 1n << BigInt(bit)
    }

    await this.prisma.userFieldPermission.upsert({
      where: { user_id_entity: { user_id: id, entity } },
      update: { allowMask: mask },
      create: { user_id: id, entity, allowMask: mask },
    })

    return {
      allowMask: mask.toString(),
    }
  }

  private async blockUserSessions(userId: number, reason: string) {
    const now = new Date()
    const sessions = await this.prisma.userLoginSession.findMany({
      where: { user_id: userId },
      select: { family_id: true, expires_at: true },
    })

    await this.prisma.userLoginSession.updateMany({
      where: { user_id: userId },
      data: {
        status: UserLoginSessionStatus.BLOCKED,
        blocked_at: now,
        blocked_reason: reason,
      },
    })

    const familyMap = new Map<string, Date>()
    for (const session of sessions) {
      const existing = familyMap.get(session.family_id)
      if (!existing || existing < session.expires_at) {
        familyMap.set(session.family_id, session.expires_at)
      }
    }

    for (const [familyId, expiresAt] of familyMap.entries()) {
      await this.loginSessionService.blockAllSessions(familyId, expiresAt)
    }
  }

  private assertCanManage(actor: RequestWithUser['user'], target: { id: number; role: number }) {
    if (actor.role < target.role) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }

    if (
      target.role === ShionlibUserRoles.SUPER_ADMIN &&
      actor.role !== ShionlibUserRoles.SUPER_ADMIN
    ) {
      throw new ShionBizException(
        ShionBizCode.AUTH_UNAUTHORIZED,
        'shion-biz.AUTH_UNAUTHORIZED',
        undefined,
        HttpStatus.FORBIDDEN,
      )
    }
  }

  private async ensureUploadQuota(tx: Prisma.TransactionClient, user_id: number) {
    const existing = await tx.userUploadQuota.findUnique({ where: { user_id } })
    if (existing) return existing
    return await tx.userUploadQuota.create({
      data: {
        size: 0n,
        used: 0n,
        is_first_grant: false,
        user: { connect: { id: user_id } },
      },
    })
  }

  async adjustUserUploadQuotaSize(
    id: number,
    dto: AdminAdjustQuotaSizeReqDto,
    actor: RequestWithUser['user'],
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }
    this.assertCanManage(actor, target)

    await this.prisma.$transaction(async tx => {
      const quota = await this.ensureUploadQuota(tx, id)
      const amount = BigInt(dto.amount)
      const delta = dto.action === 'ADD' ? amount : -amount

      if (dto.action === 'SUB') {
        const nextSize = quota.size + delta
        if (nextSize < quota.used) {
          throw new ShionBizException(
            ShionBizCode.USER_UPLOAD_QUOTA_EXCEEDED,
            'shion-biz.USER_UPLOAD_QUOTA_EXCEEDED',
          )
        }
      }

      await tx.userUploadQuotaRecord.create({
        data: {
          field: 'SIZE',
          amount,
          action: dto.action,
          action_reason: dto.action_reason ?? 'ADMIN_ADJUST',
          user_upload_quota_id: quota.id,
        },
      })

      await tx.userUploadQuota.update({
        where: { id: quota.id },
        data: {
          size: {
            increment: delta,
          },
        },
      })
    })
  }

  async adjustUserUploadQuotaUsed(
    id: number,
    dto: AdminAdjustQuotaUsedReqDto,
    actor: RequestWithUser['user'],
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }
    this.assertCanManage(actor, target)

    await this.prisma.$transaction(async tx => {
      const quota = await this.ensureUploadQuota(tx, id)
      const amount = BigInt(dto.amount)
      const delta = dto.action === 'USE' ? amount : -amount

      if (dto.action === 'USE' && quota.used + amount > quota.size) {
        throw new ShionBizException(
          ShionBizCode.USER_UPLOAD_QUOTA_EXCEEDED,
          'shion-biz.USER_UPLOAD_QUOTA_EXCEEDED',
        )
      }
      if (dto.action === 'ADD' && quota.used < amount) {
        throw new ShionBizException(
          ShionBizCode.USER_UPLOAD_QUOTA_USE_CANT_BE_NEGATIVE,
          'shion-biz.USER_UPLOAD_QUOTA_USE_CANT_BE_NEGATIVE',
        )
      }

      await tx.userUploadQuotaRecord.create({
        data: {
          field: 'USED',
          amount,
          action: dto.action,
          action_reason: dto.action_reason ?? 'ADMIN_ADJUST',
          user_upload_quota_id: quota.id,
        },
      })

      await tx.userUploadQuota.update({
        where: { id: quota.id },
        data: {
          used: {
            increment: delta,
          },
        },
      })
    })
  }

  async resetUserUploadQuotaUsed(id: number, actor: RequestWithUser['user']) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target) {
      throw new ShionBizException(ShionBizCode.USER_NOT_FOUND, 'shion-biz.USER_NOT_FOUND')
    }
    this.assertCanManage(actor, target)

    await this.prisma.$transaction(async tx => {
      const quota = await this.ensureUploadQuota(tx, id)
      if (quota.used === 0n) return

      const used = quota.used
      await tx.userUploadQuota.update({
        where: { id: quota.id },
        data: { used: 0n },
      })
      await tx.userUploadQuotaRecord.create({
        data: {
          field: 'USED',
          amount: used,
          action: 'ADD',
          action_reason: 'ADMIN_RESET_USED',
          user_upload_quota_id: quota.id,
        },
      })
    })
  }
}
