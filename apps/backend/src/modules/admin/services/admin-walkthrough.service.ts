import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { Queue } from 'bull'
import { Prisma, WalkthroughStatus } from '@prisma/client'
import { PrismaService } from '../../../prisma.service'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { AdminWalkthroughListReqDto } from '../dto/req/walkthrough-list.req.dto'
import { AdminUpdateWalkthroughStatusReqDto } from '../dto/req/walkthrough-status.req.dto'
import {
  AdminWalkthroughItemResDto,
  AdminWalkthroughModerationSummaryResDto,
} from '../dto/res/admin-walkthrough-item.res.dto'
import { AdminWalkthroughDetailResDto } from '../dto/res/admin-walkthrough-detail.res.dto'
import {
  LLM_WALKTHROUGH_MODERATION_JOB,
  MODERATION_QUEUE,
} from '../../moderate/constants/moderation.constants'

@Injectable()
export class AdminWalkthroughService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MODERATION_QUEUE) private readonly moderationQueue: Queue,
  ) {}

  async getWalkthroughList(
    query: AdminWalkthroughListReqDto,
  ): Promise<PaginatedResult<AdminWalkthroughItemResDto>> {
    const {
      page,
      pageSize,
      search,
      status,
      creatorId,
      gameId,
      sortBy = 'created',
      sortOrder = 'desc',
    } = query

    const where: Prisma.WalkthroughWhereInput = {}

    if (status) {
      where.status = status
    }
    if (creatorId) {
      where.creator_id = creatorId
    }
    if (gameId) {
      where.game_id = gameId
    }
    if (search?.trim()) {
      const keyword = search.trim()
      const or: Prisma.WalkthroughWhereInput[] = []
      if (/^\d+$/.test(keyword)) {
        const id = Number(keyword)
        or.push({ id })
        or.push({ creator_id: id })
        or.push({ game_id: id })
      }
      or.push({ title: { contains: keyword, mode: 'insensitive' } })
      or.push({ html: { contains: keyword, mode: 'insensitive' } })
      or.push({ creator: { name: { contains: keyword, mode: 'insensitive' } } })
      or.push({ creator: { email: { contains: keyword, mode: 'insensitive' } } })
      or.push({ game: { title_zh: { contains: keyword, mode: 'insensitive' } } })
      or.push({ game: { title_en: { contains: keyword, mode: 'insensitive' } } })
      or.push({ game: { title_jp: { contains: keyword, mode: 'insensitive' } } })
      where.OR = or
    }

    const [items, total] = await Promise.all([
      this.prisma.walkthrough.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          html: true,
          lang: true,
          edited: true,
          status: true,
          created: true,
          updated: true,
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
      this.prisma.walkthrough.count({ where }),
    ])

    return {
      items: items.map(item => {
        const moderation = item.moderates[0]
        const moderationSummary: AdminWalkthroughModerationSummaryResDto | undefined = moderation
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
          title: item.title,
          html: item.html,
          lang: item.lang,
          edited: item.edited,
          status: item.status,
          created: item.created,
          updated: item.updated,
          creator: item.creator,
          game: item.game,
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

  async getWalkthroughDetail(id: number): Promise<AdminWalkthroughDetailResDto> {
    const walkthrough = await this.prisma.walkthrough.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        html: true,
        content: true,
        lang: true,
        edited: true,
        status: true,
        created: true,
        updated: true,
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

    if (!walkthrough) {
      throw new ShionBizException(
        ShionBizCode.WALKTHROUGH_NOT_FOUND,
        'shion-biz.WALKTHROUGH_NOT_FOUND',
      )
    }

    return {
      id: walkthrough.id,
      title: walkthrough.title,
      html: walkthrough.html,
      content: walkthrough.content,
      lang: walkthrough.lang,
      edited: walkthrough.edited,
      status: walkthrough.status,
      created: walkthrough.created,
      updated: walkthrough.updated,
      creator: walkthrough.creator,
      game: walkthrough.game,
      moderations: walkthrough.moderates.map(event => ({
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

  async updateWalkthroughStatus(id: number, dto: AdminUpdateWalkthroughStatusReqDto) {
    const walkthrough = await this.prisma.walkthrough.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!walkthrough) {
      throw new ShionBizException(
        ShionBizCode.WALKTHROUGH_NOT_FOUND,
        'shion-biz.WALKTHROUGH_NOT_FOUND',
      )
    }

    if (walkthrough.status === dto.status) return

    await this.prisma.walkthrough.update({
      where: { id },
      data: { status: dto.status },
    })
  }

  async rescanWalkthrough(id: number) {
    const walkthrough = await this.prisma.walkthrough.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!walkthrough || walkthrough.status === WalkthroughStatus.DELETED) {
      throw new ShionBizException(
        ShionBizCode.WALKTHROUGH_NOT_FOUND,
        'shion-biz.WALKTHROUGH_NOT_FOUND',
      )
    }

    await this.moderationQueue.add(LLM_WALKTHROUGH_MODERATION_JOB, { walkthroughId: id })
  }
}
