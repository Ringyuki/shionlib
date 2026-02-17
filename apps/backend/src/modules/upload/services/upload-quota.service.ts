import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import {
  AdjustQuotaSizeAmountReqDto,
  AdjustQuotaUsedAmountReqDto,
} from '../dto/req/adjust-quota.req.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { UserUploadQuotaSizeRecordAction } from '../dto/req/adjust-quota.req.dto'
import { UserUploadQuotaUsedAmountRecordAction } from '../dto/req/adjust-quota.req.dto'
import { ShionConfigService } from '../../../common/config/services/config.service'

@Injectable()
export class UploadQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ShionConfigService,
  ) {}

  async getUploadQuota(user_id: number) {
    const quota = await this.prisma.userUploadQuota.findUnique({
      where: { user_id },
      select: {
        size: true,
        used: true,
      },
    })
    if (!quota) {
      return {
        size: 0,
        used: 0,
      }
    }
    return {
      size: Number(quota.size),
      used: Number(quota.used),
    }
  }

  async adjustUploadQuotaUsedAmount(user_id: number, dto: AdjustQuotaUsedAmountReqDto) {
    await this.prisma.$transaction(async tx => {
      const quota = await tx.userUploadQuota.findUnique({
        where: { user_id },
      })
      if (!quota) {
        throw new ShionBizException(
          ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
          'shion-biz.USER_UPLOAD_QUOTA_NOT_FOUND',
        )
      }

      const amount = BigInt(dto.amount)
      const delta = dto.action === 'USE' ? amount : -amount

      if (dto.action === 'USE' && quota.used + amount > quota.size) {
        throw new ShionBizException(
          ShionBizCode.USER_UPLOAD_QUOTA_EXCEEDED,
          'shion-biz.USER_UPLOAD_QUOTA_EXCEEDED',
        )
      } else if (dto.action === 'ADD' && quota.used < amount) {
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
          action_reason: dto.action_reason,
          upload_session_id: dto.upload_session_id,
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

  async adjustUploadQuotaSizeAmount(
    user_id: number,
    dto: AdjustQuotaSizeAmountReqDto,
  ): Promise<number> {
    await this.prisma.$transaction(async tx => {
      const quota = await tx.userUploadQuota.findUnique({
        where: { user_id },
      })
      if (!quota) {
        throw new ShionBizException(
          ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
          'shion-biz.USER_UPLOAD_QUOTA_NOT_FOUND',
        )
      }
      const amount = BigInt(dto.amount)
      const delta = dto.action === 'ADD' ? amount : -amount

      await tx.userUploadQuotaRecord.create({
        data: {
          field: 'SIZE',
          amount,
          action: dto.action,
          action_reason: dto.action_reason,
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
      if (dto.action_reason === 'INITIAL_GRANT') {
        await tx.userUploadQuota.update({
          where: { id: quota.id },
          data: { is_first_grant: true },
        })
      }
    })
    return Number(dto.amount)
  }

  async withdrawUploadQuotaUseAdjustment(user_id: number, session_id: number) {
    await this.prisma.$transaction(async tx => {
      const record = await tx.userUploadQuotaRecord.findFirst({
        where: {
          user_upload_quota: { user_id },
          upload_session_id: session_id,
          action: { in: ['USE', 'ADD'] },
          status: {
            not: 'WITHDRAWN',
          },
          field: 'USED',
        },
        orderBy: { created: 'asc' },
      })
      if (!record) return

      const delta = record.action === 'USE' ? record.amount : -record.amount

      await tx.userUploadQuotaRecord.update({
        where: { id: record.id },
        data: { status: 'WITHDRAWN' },
      })
      await tx.userUploadQuota.update({
        where: { id: record.user_upload_quota_id },
        data: {
          used: {
            decrement: delta,
          },
        },
      })
    })
  }

  async isExceeded(user_id: number, amount: number) {
    const record = await this.prisma.userUploadQuota.findUnique({
      where: { user_id },
      select: {
        used: true,
        size: true,
      },
    })
    if (!record) {
      throw new ShionBizException(
        ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
        'shion-biz.USER_UPLOAD_QUOTA_NOT_FOUND',
      )
    }
    return record.used + BigInt(amount) > record.size
  }

  async initialGrant(user_id: number) {
    const quota = await this.prisma.userUploadQuota.findUnique({
      where: { user_id },
      select: { is_first_grant: true },
    })
    if (!quota) {
      throw new ShionBizException(
        ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
        'shion-biz.USER_UPLOAD_QUOTA_NOT_FOUND',
      )
    }
    if (quota.is_first_grant) return
    const target = this.configService.get('file_upload.upload_quota.base_size_bytes')
    await this.adjustUploadQuotaSizeAmount(user_id, {
      action: UserUploadQuotaSizeRecordAction.ADD,
      amount: target,
      action_reason: 'INITIAL_GRANT',
    })
  }

  async resetUsed(user_id: number) {
    await this.prisma.$transaction(async tx => {
      const quota = await tx.userUploadQuota.findUnique({
        where: { user_id },
      })
      if (!quota) {
        throw new ShionBizException(
          ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
          'shion-biz.USER_UPLOAD_QUOTA_NOT_FOUND',
        )
      }
      const used = quota.used
      if (used === 0n) return
      await tx.userUploadQuota.update({
        where: { id: quota.id },
        data: {
          used: 0n,
        },
      })
      await tx.userUploadQuotaRecord.create({
        data: {
          field: 'USED',
          amount: used,
          action: UserUploadQuotaUsedAmountRecordAction.ADD,
          action_reason: 'RESET_USED',
          user_upload_quota_id: quota.id,
        },
      })
    })
  }

  async dynamicTopup(user_id: number) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const quota = await this.prisma.userUploadQuota.findUnique({
      where: { user_id },
      select: {
        id: true,
        size: true,
        used: true,
        is_first_grant: true,
      },
    })
    if (!quota) {
      throw new ShionBizException(
        ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
        'shion-biz.USER_UPLOAD_QUOTA_NOT_FOUND',
      )
    }
    if (!quota.is_first_grant) return

    const remaining = quota.size - quota.used

    if (
      quota.size < BigInt(this.configService.get('file_upload.upload_quota.cap_size_bytes')) &&
      remaining <=
        BigInt(this.configService.get('file_upload.upload_quota.dynamic_threshold_bytes'))
    ) {
      const hasApprovedThisMonth = await this.prisma.gameDownloadResourceFile.count({
        where: {
          creator_id: user_id,
          file_check_status: 1, // ok
          created: { gte: startOfMonth },
        },
      })
      if (hasApprovedThisMonth > 0) {
        const step = this.configService.get('file_upload.upload_quota.dynamic_step_bytes')
        await this.adjustUploadQuotaSizeAmount(user_id, {
          action: UserUploadQuotaSizeRecordAction.ADD,
          amount: Number(step),
          action_reason: 'DYNAMIC_TOPUP',
        })
      }
    }
  }

  async dynamicReduce(user_id: number) {
    const quota = await this.prisma.userUploadQuota.findUnique({
      where: { user_id },
      select: {
        id: true,
        size: true,
        is_first_grant: true,
      },
    })
    if (!quota) {
      throw new ShionBizException(
        ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
        'shion-biz.USER_UPLOAD_QUOTA_NOT_FOUND',
      )
    }
    if (!quota.is_first_grant) return

    const baseSize = BigInt(this.configService.get('file_upload.upload_quota.base_size_bytes'))
    if (quota.size <= baseSize) return

    const inactiveDays = this.configService.get(
      'file_upload.upload_quota.dynamic_reduce_inactive_days',
    )
    if (inactiveDays <= 0) return

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - inactiveDays)

    const hasRecentApproved = await this.prisma.gameDownloadResourceFile.count({
      where: {
        creator_id: user_id,
        file_check_status: 1,
        created: { gte: cutoff },
      },
    })
    if (hasRecentApproved > 0) return

    const step = BigInt(
      this.configService.get('file_upload.upload_quota.dynamic_reduce_step_bytes'),
    )
    if (step <= 0n) return

    const reducible = quota.size - baseSize
    if (reducible <= 0n) return

    const amount = reducible > step ? step : reducible
    if (amount <= 0n) return

    await this.adjustUploadQuotaSizeAmount(user_id, {
      action: UserUploadQuotaSizeRecordAction.SUB,
      amount: Number(amount),
      action_reason: 'DYNAMIC_REDUCE',
    })
  }

  async resetQuota(user_id: number) {
    const quota = await this.prisma.userUploadQuota.findUnique({
      where: { user_id },
    })
    if (!quota) {
      throw new ShionBizException(
        ShionBizCode.USER_UPLOAD_QUOTA_NOT_FOUND,
        'shion-biz.USER_UPLOAD_QUOTA_NOT_FOUND',
      )
    }
    await this.adjustUploadQuotaSizeAmount(user_id, {
      action: UserUploadQuotaSizeRecordAction.SUB,
      amount: Number(quota.size),
      action_reason: 'RESET_QUOTA',
    })
  }
}
