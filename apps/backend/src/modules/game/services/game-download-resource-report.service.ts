import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import {
  GameDownloadResourceReportReason,
  GameDownloadResourceReportStatus,
  Prisma,
  ReportMaliciousLevel,
} from '@prisma/client'
import { CreateGameDownloadSourceReportReqDto } from '../dto/req/create-game-download-source-report.req.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { GetDownloadResourceReportListReqDto } from '../../admin/dto/req/download-resource-report-list.req.dto'
import {
  GameDownloadSourceReportVerdict,
  ReviewGameDownloadSourceReportReqDto,
} from '../../admin/dto/req/review-game-download-source-report.req.dto'
import { UserService } from '../../user/services/user.service'
import { MessageService } from '../../message/services/message.service'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { UserStatus } from '../../user/interfaces/user.interface'
import { UploadQuotaService } from '../../upload/services/upload-quota.service'
import { UserUploadQuotaSizeRecordAction } from '../../upload/dto/req/adjust-quota.req.dto'
import { GameDownloadSourceService } from './game-download-resource.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { EmailService } from '../../email/services/email.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import {
  DEFAULT_LEVEL_BY_REASON,
  ONE_GB_BYTES,
  TARGET_PENALTY_BY_LEVEL,
  FALSE_REPORT_WINDOW_DAYS,
  FALSE_REPORT_SUSPEND_THRESHOLD,
} from '../constants/download-resource-report.constant'

@Injectable()
export class GameDownloadResourceReportService {
  private readonly logger = new Logger(GameDownloadResourceReportService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly messageService: MessageService,
    private readonly uploadQuotaService: UploadQuotaService,
    private readonly gameDownloadSourceService: GameDownloadSourceService,
    private readonly emailService: EmailService,
    private readonly configService: ShionConfigService,
  ) {}

  async create(resourceId: number, dto: CreateGameDownloadSourceReportReqDto, reporterId: number) {
    const resource = await this.prisma.gameDownloadResource.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        creator_id: true,
        status: true,
        game_id: true,
        game: {
          select: {
            id: true,
            title_jp: true,
            title_zh: true,
            title_en: true,
          },
        },
      },
    })

    if (!resource) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_FOUND,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_NOT_FOUND',
      )
    }
    if (resource.status !== 1) {
      throw new ShionBizException(
        ShionBizCode.GAME_DOWNLOAD_RESOURCE_NOT_FOUND,
        'shion-biz.GAME_DOWNLOAD_RESOURCE_NOT_FOUND',
      )
    }

    if (resource.creator_id === reporterId) {
      throw new ShionBizException(ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_SELF_NOT_ALLOWED)
    }

    const suspended = await this.isReporterSuspended(reporterId)
    if (suspended) {
      throw new ShionBizException(ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_SUSPENDED)
    }

    const existedPending = await this.prisma.gameDownloadResourceReport.findFirst({
      where: {
        resource_id: resourceId,
        reporter_id: reporterId,
        status: GameDownloadResourceReportStatus.PENDING,
      },
      select: { id: true },
    })

    if (existedPending) {
      throw new ShionBizException(ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_DUPLICATED)
    }

    const report = await this.prisma.gameDownloadResourceReport.create({
      data: {
        resource_id: resourceId,
        reporter_id: reporterId,
        reported_user_id: resource.creator_id,
        reason: dto.reason,
        detail: dto.detail,
        malicious_level: DEFAULT_LEVEL_BY_REASON[dto.reason],
      },
      select: {
        id: true,
        status: true,
        reason: true,
        malicious_level: true,
        created: true,
      },
    })

    this.notifyAdminsNewReport(report.id, {
      resourceId,
      reporterId,
      reportedUserId: resource.creator_id,
      reason: dto.reason,
      maliciousLevel: report.malicious_level,
      detail: dto.detail,
      gameId: resource.game_id,
      gameTitle: resource.game.title_zh || resource.game.title_jp || resource.game.title_en || '',
    }).catch(err => {
      this.logger.error('Failed to notify admins about new report:', err)
    })

    return report
  }

  async getList(dto: GetDownloadResourceReportListReqDto) {
    const {
      page,
      pageSize,
      status,
      reason,
      malicious_level,
      resource_id,
      reporter_id,
      reported_user_id,
      sortBy = 'created',
      sortOrder = 'desc',
    } = dto

    const where: Prisma.GameDownloadResourceReportWhereInput = {
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
      ...(malicious_level ? { malicious_level } : {}),
      ...(resource_id ? { resource_id } : {}),
      ...(reporter_id ? { reporter_id } : {}),
      ...(reported_user_id ? { reported_user_id } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.gameDownloadResourceReport.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reason: true,
          detail: true,
          status: true,
          malicious_level: true,
          processed_at: true,
          process_note: true,
          created: true,
          updated: true,
          resource: {
            select: {
              id: true,
              game_id: true,
              game: {
                select: {
                  id: true,
                  title_jp: true,
                  title_zh: true,
                  title_en: true,
                },
              },
              files: {
                select: {
                  id: true,
                  file_name: true,
                },
                take: 5,
              },
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          reported_user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          processor: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.gameDownloadResourceReport.count({ where }),
    ])

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getById(id: number) {
    const report = await this.prisma.gameDownloadResourceReport.findUnique({
      where: { id },
      select: {
        id: true,
        reason: true,
        detail: true,
        status: true,
        malicious_level: true,
        process_note: true,
        processed_at: true,
        reporter_penalty_applied: true,
        reported_penalty_applied: true,
        created: true,
        updated: true,
        resource: {
          select: {
            id: true,
            game_id: true,
            note: true,
            game: {
              select: {
                id: true,
                title_jp: true,
                title_zh: true,
                title_en: true,
              },
            },
            files: {
              select: {
                id: true,
                file_name: true,
                file_size: true,
                file_status: true,
                file_check_status: true,
                hash_algorithm: true,
                file_hash: true,
              },
            },
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            status: true,
          },
        },
        reported_user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            status: true,
          },
        },
        processor: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    if (!report) {
      throw new ShionBizException(ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_NOT_FOUND)
    }

    return {
      ...report,
      resource: {
        ...report.resource,
        files: report.resource.files.map(file => ({
          ...file,
          file_size: Number(file.file_size),
        })),
      },
    }
  }

  async review(
    id: number,
    dto: ReviewGameDownloadSourceReportReqDto,
    actor: { sub: number; role: number },
  ) {
    const report = await this.prisma.gameDownloadResourceReport.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        reason: true,
        malicious_level: true,
        reporter_id: true,
        reported_user_id: true,
        resource_id: true,
        resource: {
          select: {
            id: true,
            game_id: true,
            game: {
              select: {
                id: true,
                title_jp: true,
                title_zh: true,
                title_en: true,
              },
            },
          },
        },
      },
    })
    if (!report) {
      throw new ShionBizException(ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_NOT_FOUND)
    }
    if (report.status !== GameDownloadResourceReportStatus.PENDING) {
      throw new ShionBizException(ShionBizCode.GAME_DOWNLOAD_RESOURCE_REPORT_ALREADY_PROCESSED)
    }

    const notify = dto.notify !== false
    const now = new Date()

    const reportId = await this.prisma.$transaction(async tx => {
      const nextStatus =
        dto.verdict === GameDownloadSourceReportVerdict.VALID
          ? GameDownloadResourceReportStatus.VALID
          : GameDownloadResourceReportStatus.INVALID

      let maliciousLevel = dto.malicious_level ?? report.malicious_level
      if (
        dto.verdict === GameDownloadSourceReportVerdict.VALID &&
        report.reason === GameDownloadResourceReportReason.MALWARE
      ) {
        maliciousLevel = ReportMaliciousLevel.CRITICAL
      }

      await tx.gameDownloadResourceReport.update({
        where: { id: report.id },
        data: {
          status: nextStatus,
          malicious_level: maliciousLevel,
          processed_by: actor.sub,
          processed_at: now,
          process_note: dto.process_note,
        },
      })

      if (nextStatus === GameDownloadResourceReportStatus.VALID) {
        const penalty = await this.applyReportedUserPenalty(
          tx,
          report.reported_user_id,
          maliciousLevel,
          report.reason,
          actor.sub,
        )

        await tx.gameDownloadResourceReport.update({
          where: { id: report.id },
          data: {
            reported_penalty_applied: penalty.banApplied || penalty.quotaReducedBytes > 0,
          },
        })

        if (notify) {
          await this.messageService.send(
            {
              type: MessageType.SYSTEM,
              tone: MessageTone.SUCCESS,
              title: 'Messages.System.Report.Valid.Title',
              content: 'Messages.System.Report.Valid.Content',
              receiver_id: report.reporter_id,
              game_id: report.resource.game_id,
              meta: {
                reason: report.reason,
                malicious_level: maliciousLevel,
                process_note: dto.process_note ?? null,
              },
            },
            tx,
          )

          await this.messageService.send(
            {
              type: MessageType.SYSTEM,
              tone: MessageTone.DESTRUCTIVE,
              title: 'Messages.System.Report.Penalty.Title',
              content: 'Messages.System.Report.Penalty.Content',
              receiver_id: report.reported_user_id,
              game_id: report.resource.game_id,
              meta: {
                reason: report.reason,
                malicious_level: maliciousLevel,
                ban_days: penalty.banDays,
                quota_sub_gb: penalty.quotaReducedBytes
                  ? Math.floor(penalty.quotaReducedBytes / ONE_GB_BYTES)
                  : 0,
                process_note: dto.process_note ?? null,
              },
            },
            tx,
          )
        }
      }

      if (nextStatus === GameDownloadResourceReportStatus.INVALID) {
        const penalty = await this.applyReporterInvalidPenalty(tx, report.reporter_id, actor.sub)

        await tx.gameDownloadResourceReport.update({
          where: { id: report.id },
          data: {
            reporter_penalty_applied: penalty.banApplied || penalty.quotaReducedBytes > 0,
          },
        })

        if (notify) {
          await this.messageService.send(
            {
              type: MessageType.SYSTEM,
              tone: MessageTone.WARNING,
              title: 'Messages.System.Report.Invalid.Title',
              content: 'Messages.System.Report.Invalid.Content',
              receiver_id: report.reporter_id,
              game_id: report.resource.game_id,
              meta: {
                false_report_count: penalty.falseReportCount,
                ban_days: penalty.banDays,
                quota_sub_gb: penalty.quotaReducedBytes
                  ? Math.floor(penalty.quotaReducedBytes / ONE_GB_BYTES)
                  : 0,
                process_note: dto.process_note ?? null,
              },
            },
            tx,
          )
        }
      }

      return report.id
    })

    const reviewedSnapshot = await this.getById(reportId)
    if (dto.verdict === GameDownloadSourceReportVerdict.VALID) {
      await this.gameDownloadSourceService.delete(
        report.resource_id,
        {
          user: {
            sub: actor.sub,
            role: actor.role,
          },
        } as RequestWithUser,
        true,
      )
    }
    return reviewedSnapshot
  }

  private async isReporterSuspended(reporterId: number) {
    const since = new Date(Date.now() - FALSE_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const falseCount = await this.prisma.gameDownloadResourceReport.count({
      where: {
        reporter_id: reporterId,
        status: GameDownloadResourceReportStatus.INVALID,
        created: {
          gte: since,
        },
      },
    })

    return falseCount >= FALSE_REPORT_SUSPEND_THRESHOLD
  }

  private async applyReportedUserPenalty(
    tx: Prisma.TransactionClient,
    userId: number,
    level: ReportMaliciousLevel,
    reason: GameDownloadResourceReportReason,
    actorId: number,
  ) {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    })

    if (!target || target.role > ShionlibUserRoles.USER) {
      return {
        banApplied: false,
        banDays: 0,
        quotaReducedBytes: 0,
      }
    }

    const policy = TARGET_PENALTY_BY_LEVEL[level]
    if (policy.quotaSubBytes > 0)
      await this.uploadQuotaService.adjustUploadQuotaSizeAmount(userId, {
        action: UserUploadQuotaSizeRecordAction.SUB,
        amount: policy.quotaSubBytes,
        action_reason: `REPORT_${reason}`,
      })

    let banApplied = false
    if (policy.banDays > 0 && target.status !== UserStatus.BANNED) {
      banApplied = await this.tryBanUser(
        tx,
        userId,
        actorId,
        policy.banDays,
        `Resource report: ${reason}`,
      )
    }

    return {
      banApplied,
      banDays: banApplied ? policy.banDays : 0,
      quotaReducedBytes: policy.quotaSubBytes,
    }
  }

  private async applyReporterInvalidPenalty(
    tx: Prisma.TransactionClient,
    reporterId: number,
    actorId: number,
  ) {
    const reporter = await tx.user.findUnique({
      where: { id: reporterId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    })

    if (!reporter || reporter.role > ShionlibUserRoles.USER) {
      return {
        falseReportCount: 0,
        banApplied: false,
        banDays: 0,
        quotaReducedBytes: 0,
      }
    }

    const since = new Date(Date.now() - FALSE_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const falseReportCount = await tx.gameDownloadResourceReport.count({
      where: {
        reporter_id: reporterId,
        status: GameDownloadResourceReportStatus.INVALID,
        created: {
          gte: since,
        },
      },
    })

    let quotaReducedBytes = 0
    let banDays = 0

    if (falseReportCount === 3) {
      quotaReducedBytes = await this.uploadQuotaService.adjustUploadQuotaSizeAmount(reporterId, {
        action: UserUploadQuotaSizeRecordAction.SUB,
        amount: ONE_GB_BYTES,
        action_reason: 'REPORT_FALSE_POSITIVE',
      })
    }

    if (falseReportCount === 5) {
      banDays = 3
    } else if (falseReportCount === 8) {
      banDays = 14
    }

    let banApplied = false
    if (banDays > 0 && reporter.status !== UserStatus.BANNED) {
      banApplied = await this.tryBanUser(
        tx,
        reporterId,
        actorId,
        banDays,
        `Malicious reports: ${falseReportCount} in ${FALSE_REPORT_WINDOW_DAYS} days`,
      )
    }

    return {
      falseReportCount,
      banApplied,
      banDays: banApplied ? banDays : 0,
      quotaReducedBytes,
    }
  }

  private async tryBanUser(
    tx: Prisma.TransactionClient,
    userId: number,
    actorId: number,
    banDays: number,
    reason: string,
  ): Promise<boolean> {
    try {
      await this.userService.ban(
        userId,
        {
          banned_by: actorId,
          banned_reason: reason,
          banned_duration_days: banDays,
          is_permanent: false,
        },
        tx,
      )
      return true
    } catch (error) {
      if (error instanceof ShionBizException && error.code === ShionBizCode.USER_ALREADY_BANNED) {
        return false
      }
      throw error
    }
  }

  private async notifyAdminsNewReport(
    reportId: number,
    data: {
      resourceId: number
      reporterId: number
      reportedUserId: number
      reason: GameDownloadResourceReportReason
      maliciousLevel: ReportMaliciousLevel
      detail?: string
      gameId: number
      gameTitle: string
    },
  ) {
    const [admins, reporter, reportedUser] = await Promise.all([
      this.getAdmins(),
      this.prisma.user.findUnique({
        where: { id: data.reporterId },
        select: { id: true, name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: data.reportedUserId },
        select: { id: true, name: true },
      }),
    ])
    if (admins.length === 0) return

    const reporterName = reporter?.name ?? `User#${data.reporterId}`
    const reportedUserName = reportedUser?.name ?? `User#${data.reportedUserId}`
    const siteUrl = this.configService.get('siteUrl')
    const adminReviewUrl = `${siteUrl}/admin/reports?id=${reportId}`

    const messagePromises: Promise<unknown>[] = admins.map(admin =>
      this.messageService.send({
        type: MessageType.SYSTEM,
        tone: MessageTone.WARNING,
        title: 'Messages.System.Report.NewReport.Title',
        content: 'Messages.System.Report.NewReport.Content',
        receiver_id: admin.id,
        game_id: data.gameId,
        link_text: 'Messages.System.Report.NewReport.LinkText',
        link_url: `/admin/reports?id=${reportId}`,
        meta: {
          report_id: reportId,
          reporter_name: reporterName,
          reported_user_name: reportedUserName,
          reason: data.reason,
          malicious_level: data.maliciousLevel,
        },
      }),
    )
    const adminEmails = admins.map(admin => admin.email).filter((email): email is string => !!email)
    if (adminEmails.length > 0) {
      messagePromises.push(
        this.emailService.sendReportNotification(adminEmails, {
          reportId,
          reporterName,
          reportedUserName,
          reason: data.reason,
          maliciousLevel: data.maliciousLevel,
          gameTitle: data.gameTitle,
          detail: data.detail,
          adminReviewUrl,
        }),
      )
    }
    await Promise.allSettled(messagePromises)
  }

  private async getAdmins() {
    return this.prisma.user.findMany({
      where: {
        role: {
          gte: ShionlibUserRoles.ADMIN,
        },
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })
  }
}
