import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { UploadQuotaService } from '../services/upload-quota.service'
import { UserStatus } from '../../user/interfaces/user.interface'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'

@Injectable()
export class UploadQuotaTask {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ShionConfigService,
    private readonly uploadQuotaService: UploadQuotaService,
  ) {}

  private readonly logger = new Logger(UploadQuotaTask.name)

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleInitialGrant() {
    try {
      const now = new Date()
      const cutoff = new Date(
        now.getTime() -
          this.configService.get('file_upload.upload_quota.grant_after_days') * 24 * 60 * 60 * 1000,
      )
      const users = await this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          role: ShionlibUserRoles.USER,
          upload_quota: { is: { is_first_grant: false } },
          created: {
            lte: cutoff,
          },
        },
        select: { id: true },
      })

      for (const u of users) await this.uploadQuotaService.initialGrant(u.id)
    } catch (error) {
      this.logger.error('Error running upload quota cron', error)
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleDynamicTopup() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          role: ShionlibUserRoles.USER,
          upload_quota: { isNot: null },
        },
        select: { id: true },
      })
      for (const u of users) await this.uploadQuotaService.dynamicTopup(u.id)
    } catch (error) {
      this.logger.error('Error running upload quota cron', error)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDynamicReduce() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          role: ShionlibUserRoles.USER,
          upload_quota: { isNot: null },
        },
        select: { id: true },
      })
      for (const u of users) await this.uploadQuotaService.dynamicReduce(u.id)
    } catch (error) {
      this.logger.error('Error running upload quota dynamic reduce cron', error)
    }
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleResetUsed() {
    try {
      const users = await this.prisma.user.findMany({
        where: { status: UserStatus.ACTIVE, role: ShionlibUserRoles.USER },
        select: { id: true },
      })
      for (const u of users) await this.uploadQuotaService.resetUsed(u.id)
    } catch (error) {
      this.logger.error('Error running upload quota cron', error)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleLongestInactive() {
    try {
      const longestInactiveDays = this.configService.get(
        'file_upload.upload_quota.longest_inactive_days',
      )
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - longestInactiveDays)
      const users = await this.prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          role: ShionlibUserRoles.USER,
          upload_quota: { isNot: null },
          NOT: { sessions: { some: { updated: { gte: cutoff } } } },
        },
        select: { id: true },
      })
      for (const u of users) await this.uploadQuotaService.resetQuota(u.id)
    } catch (error) {
      this.logger.error('Error running upload quota cron', error)
    }
  }
}
