import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { Prisma, ModerateCategoryKey } from '@prisma/client'
import { PrismaService } from '../../../prisma.service'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { AdminCommentListReqDto } from '../dto/req/comment-list.req.dto'
import {
  AdminCommentItemResDto,
  AdminCommentModerationSummaryResDto,
} from '../dto/res/admin-comment-item.res.dto'
import { AdminCommentDetailResDto } from '../dto/res/admin-comment-detail.res.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { AdminUpdateCommentStatusReqDto } from '../dto/req/comment-status.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { MessageService } from '../../message/services/message.service'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'
import {
  MODERATION_QUEUE,
  OMNI_MODERATION_JOB,
} from '../../moderate/constants/moderation.constants'

@Injectable()
export class AdminCommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly messageService: MessageService,
    @InjectQueue(MODERATION_QUEUE) private readonly moderationQueue: Queue,
  ) {}

  async getCommentList(
    query: AdminCommentListReqDto,
  ): Promise<PaginatedResult<AdminCommentItemResDto>> {
    const { page, pageSize, search, status, sortBy = 'created', sortOrder = 'desc' } = query

    const where: Prisma.CommentWhereInput = {}

    if (status !== undefined) {
      where.status = status
    }
    if (query.creatorId) {
      where.creator_id = query.creatorId
    }
    if (query.gameId) {
      where.game_id = query.gameId
    }
    if (search && search.trim()) {
      const keyword = search.trim()
      const or: Prisma.CommentWhereInput[] = []
      if (/^\d+$/.test(keyword)) {
        const id = Number(keyword)
        or.push({ id })
        or.push({ creator_id: id })
        or.push({ game_id: id })
      }
      or.push({ html: { contains: keyword, mode: 'insensitive' } })
      or.push({ creator: { name: { contains: keyword, mode: 'insensitive' } } })
      or.push({ creator: { email: { contains: keyword, mode: 'insensitive' } } })
      or.push({ game: { title_zh: { contains: keyword, mode: 'insensitive' } } })
      or.push({ game: { title_en: { contains: keyword, mode: 'insensitive' } } })
      or.push({ game: { title_jp: { contains: keyword, mode: 'insensitive' } } })
      where.OR = or
    }

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          html: true,
          parent_id: true,
          parent: {
            select: {
              id: true,
              html: true,
              creator: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
          root_id: true,
          reply_count: true,
          edited: true,
          status: true,
          created: true,
          updated: true,
          _count: {
            select: {
              liked_users: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
              email: true,
            },
          },
          game: {
            select: {
              id: true,
              title_jp: true,
              title_zh: true,
              title_en: true,
            },
          },
          moderates: {
            take: 1,
            orderBy: { created_at: 'desc' },
            select: {
              id: true,
              decision: true,
              model: true,
              top_category: true,
              max_score: true,
              reason: true,
              evidence: true,
              created_at: true,
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ])

    return {
      items: items.map(item => {
        const moderation = item.moderates[0]
        const moderationSummary: AdminCommentModerationSummaryResDto | undefined = moderation
          ? {
              id: moderation.id,
              decision: moderation.decision,
              model: moderation.model,
              top_category: moderation.top_category,
              max_score: moderation.max_score ? Number(moderation.max_score) : null,
              reason: moderation.reason ?? undefined,
              evidence: moderation.evidence ?? undefined,
              created_at: moderation.created_at,
            }
          : undefined

        return {
          id: item.id,
          html: item.html,
          parent_id: item.parent_id,
          root_id: item.root_id,
          reply_count: item.reply_count,
          like_count: item._count.liked_users,
          creator: item.creator,
          parent: item.parent
            ? {
                id: item.parent.id,
                html: item.parent.html,
                creator: item.parent.creator,
              }
            : null,
          game: item.game,
          edited: item.edited,
          status: item.status,
          created: item.created,
          updated: item.updated,
          moderation: moderationSummary,
        }
      }),
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getCommentDetail(id: number): Promise<AdminCommentDetailResDto> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        html: true,
        content: true,
        parent_id: true,
        parent: {
          select: {
            id: true,
            html: true,
            creator: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        root_id: true,
        reply_count: true,
        edited: true,
        status: true,
        created: true,
        updated: true,
        _count: {
          select: {
            liked_users: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
        game: {
          select: {
            id: true,
            title_jp: true,
            title_zh: true,
            title_en: true,
          },
        },
        moderates: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            audit_by: true,
            model: true,
            decision: true,
            top_category: true,
            categories_json: true,
            scores_json: true,
            max_score: true,
            reason: true,
            evidence: true,
            created_at: true,
          },
        },
      },
    })

    if (!comment) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND, 'shion-biz.COMMENT_NOT_FOUND')
    }

    return {
      id: comment.id,
      html: comment.html,
      content: comment.content,
      parent_id: comment.parent_id,
      root_id: comment.root_id,
      reply_count: comment.reply_count,
      like_count: comment._count.liked_users,
      creator: comment.creator,
      parent: comment.parent
        ? {
            id: comment.parent.id,
            html: comment.parent.html,
            creator: comment.parent.creator,
          }
        : null,
      game: comment.game,
      edited: comment.edited,
      status: comment.status,
      created: comment.created,
      updated: comment.updated,
      moderations: comment.moderates.map(event => ({
        id: event.id,
        audit_by: event.audit_by,
        model: event.model,
        decision: event.decision,
        top_category: event.top_category,
        categories_json: event.categories_json,
        scores_json: event.scores_json,
        max_score: event.max_score ? Number(event.max_score) : null,
        reason: event.reason ?? undefined,
        evidence: event.evidence ?? undefined,
        created_at: event.created_at,
      })),
    }
  }

  async updateCommentStatus(
    id: number,
    dto: AdminUpdateCommentStatusReqDto,
    actor: RequestWithUser['user'],
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        creator_id: true,
        game_id: true,
        parent_id: true,
        parent: {
          select: {
            creator_id: true,
          },
        },
      },
    })

    if (!comment) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND, 'shion-biz.COMMENT_NOT_FOUND')
    }

    const nextStatus = dto.status
    if (comment.status === nextStatus) return
    const shouldNotify = dto.notify !== false
    const topCategory = dto.top_category ?? ModerateCategoryKey.HARASSMENT

    await this.prisma.$transaction(async tx => {
      await tx.comment.update({
        where: { id },
        data: { status: nextStatus },
      })

      if (nextStatus === 1 && comment.status !== 1) {
        const existedActivity = await tx.activity.findFirst({
          where: { comment_id: id, type: ActivityType.COMMENT },
          select: { id: true },
        })
        if (!existedActivity) {
          await this.activityService.create(
            {
              type: ActivityType.COMMENT,
              user_id: comment.creator_id,
              game_id: comment.game_id,
              comment_id: id,
            },
            tx,
          )
        }

        if (
          comment.parent_id &&
          comment.parent?.creator_id &&
          comment.parent.creator_id !== comment.creator_id
        ) {
          const existedMessage = await tx.message.findFirst({
            where: {
              type: MessageType.COMMENT_REPLY,
              comment_id: id,
              receiver_id: comment.parent.creator_id,
            },
            select: { id: true },
          })
          if (!existedMessage) {
            await this.messageService.send(
              {
                type: MessageType.COMMENT_REPLY,
                tone: MessageTone.INFO,
                title: 'Messages.Comment.Reply.Title',
                content: 'Messages.Comment.Reply.Content',
                receiver_id: comment.parent.creator_id,
                comment_id: id,
                game_id: comment.game_id,
                sender_id: comment.creator_id,
              },
              tx,
            )
          }
        }
      }

      if (nextStatus === 3 && shouldNotify) {
        const contentKey =
          dto.reason || dto.evidence
            ? 'Messages.System.Moderation.Comment.Block.ReviewContent'
            : 'Messages.System.Moderation.Comment.Block.Content'
        await this.messageService.send(
          {
            type: MessageType.SYSTEM,
            tone: MessageTone.DESTRUCTIVE,
            title: 'Messages.System.Moderation.Comment.Block.Title',
            content: contentKey,
            receiver_id: comment.creator_id,
            comment_id: id,
            game_id: comment.game_id,
            sender_id: actor?.sub,
            meta: {
              top_category: topCategory,
              reason: dto.reason,
              evidence: dto.evidence,
            },
          },
          tx,
        )
      }
    })
  }

  async rescanComment(id: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!comment) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND, 'shion-biz.COMMENT_NOT_FOUND')
    }

    await this.prisma.comment.update({
      where: { id },
      data: { status: 2 },
    })

    await this.moderationQueue.add(OMNI_MODERATION_JOB, { commentId: id })
  }
}
