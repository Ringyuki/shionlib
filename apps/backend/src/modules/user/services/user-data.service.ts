import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GameResourcesResDto } from '../dto/res/game-resources.res.dto'
import { Prisma } from '@prisma/client'
import { UserContentLimit } from '../interfaces/user.interface'
import { CommentResDto } from '../../comment/dto/res/comment.res.dto'
import { EditRecordItem } from '../dto/res/edit-records.res.dto'

@Injectable()
export class UserDataService {
  constructor(private readonly prismaService: PrismaService) {}

  async getGameResources(
    user_id: number,
    req: RequestWithUser,
    dto: PaginationReqDto,
  ): Promise<PaginatedResult<GameResourcesResDto>> {
    const { page, pageSize } = dto

    const where: Prisma.GameDownloadResourceWhereInput = {}
    if (
      req.user?.content_limit === UserContentLimit.NEVER_SHOW_NSFW_CONTENT ||
      !req.user?.content_limit
    ) {
      where.game = {
        nsfw: {
          not: true,
        },
      }
    }
    const resources = await this.prismaService.gameDownloadResource.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: {
        creator_id: user_id,
        ...where,
      },
      select: {
        id: true,
        platform: true,
        language: true,
        note: true,
        downloads: true,
        files: {
          select: {
            file_name: true,
          },
        },
        created: true,
        updated: true,
        game: {
          select: {
            id: true,
            title_jp: true,
            title_zh: true,
            title_en: true,
            developers: {
              select: {
                role: true,
                developer: {
                  select: {
                    id: true,
                    name: true,
                    aliases: true,
                  },
                },
              },
            },
            covers: {
              select: {
                url: true,
                language: true,
                dims: true,
                sexual: true,
                violence: true,
              },
            },
          },
        },
      },
    })

    const isCurrentUser = user_id === req.user?.sub
    const onGoingSessions = await this.prismaService.gameUploadSession.findMany({
      where: {
        creator_id: user_id,
        status: 'UPLOADING',
      },
      select: {
        id: true,
      },
    })
    const hasOnGoingSession = onGoingSessions.length > 0

    const total = await this.prismaService.gameDownloadResource.count({
      where: {
        creator_id: user_id,
        ...where,
      },
    })

    return {
      items: resources.map(r => ({
        id: r.id,
        platform: r.platform,
        language: r.language,
        note: r.note,
        downloads: r.downloads,
        file_name: r.files[0].file_name,
        more_than_one_file: r.files.length > 1,
        files_count: r.files.length,
        game: r.game,
        created: r.created,
        updated: r.updated,
      })) as unknown as GameResourcesResDto[],
      meta: {
        totalItems: total,
        itemCount: resources.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        is_current_user: isCurrentUser,
        has_on_going_session: isCurrentUser ? hasOnGoingSession : false,
        content_limit: req.user?.content_limit,
      },
    }
  }

  async getComments(
    user_id: number,
    req: RequestWithUser,
    dto: PaginationReqDto,
  ): Promise<PaginatedResult<CommentResDto>> {
    const { page, pageSize } = dto
    const where: Prisma.CommentWhereInput = {
      creator_id: user_id,
      status: 1,
    }
    const total = await this.prismaService.comment.count({
      where,
    })
    const comments = await this.prismaService.comment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        html: true,
        parent_id: true,
        root_id: true,
        reply_count: true,
        parent: {
          select: {
            id: true,
            html: true,
            creator: { select: { id: true, name: true, avatar: true } },
          },
        },
        liked_users: { where: { id: req.user?.sub || 0 }, select: { id: true }, take: 1 },
        _count: { select: { liked_users: true } },
        game: { select: { id: true, title_jp: true, title_zh: true, title_en: true } },
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        created: true,
        updated: true,
      },
    })

    const isCurrentUser = user_id === req.user?.sub
    return {
      items: comments.map(comment => ({
        id: comment.id,
        html: comment.html,
        parent_id: comment.parent_id,
        root_id: comment.root_id,
        reply_count: comment.reply_count,
        parent: comment.parent,
        is_liked: comment.liked_users.length > 0,
        like_count: comment._count.liked_users,
        game: comment.game,
        creator: comment.creator,
        created: comment.created,
        updated: comment.updated,
      })) as unknown as CommentResDto[],
      meta: {
        totalItems: total,
        itemCount: comments.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        is_current_user: isCurrentUser,
      },
    }
  }

  async getEditRecords(
    user_id: number,
    dto: PaginationReqDto,
  ): Promise<PaginatedResult<EditRecordItem>> {
    const { page, pageSize } = dto
    const total = await this.prismaService.editRecord.count({
      where: {
        actor_id: user_id,
      },
    })
    const editRecords = await this.prismaService.editRecord.findMany({
      where: {
        actor_id: user_id,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        created: 'desc',
      },
      select: {
        id: true,
        entity: true,
        target_id: true,
        action: true,
        field_changes: true,
        changes: true,
        relation_type: true,
        created: true,
        updated: true,
      },
    })

    const gameIds = new Set<number>()
    const characterIds = new Set<number>()
    const developerIds = new Set<number>()

    editRecords.forEach(r => {
      switch (r.entity) {
        case 'game':
          gameIds.add(r.target_id)
          break
        case 'character':
          characterIds.add(r.target_id)
          break
        case 'developer':
          developerIds.add(r.target_id)
          break
      }
    })

    const [games, characters, developers] = await Promise.all([
      gameIds.size > 0
        ? this.prismaService.game.findMany({
            where: { id: { in: Array.from(gameIds) } },
            select: { id: true, title_jp: true, title_zh: true, title_en: true },
          })
        : [],
      characterIds.size > 0
        ? this.prismaService.gameCharacter.findMany({
            where: { id: { in: Array.from(characterIds) } },
            select: { id: true, name_jp: true, name_zh: true, name_en: true },
          })
        : [],
      developerIds.size > 0
        ? this.prismaService.gameDeveloper.findMany({
            where: { id: { in: Array.from(developerIds) } },
            select: { id: true, name: true, aliases: true },
          })
        : [],
    ])

    const gameMap = new Map(games.map(g => [g.id, g] as const))
    const characterMap = new Map(characters.map(c => [c.id, c] as const))
    const developerMap = new Map(developers.map(d => [d.id, d] as const))

    const result: EditRecordItem[] = editRecords.map(r => {
      switch (r.entity) {
        case 'game':
          return {
            ...r,
            entity: 'game' as const,
            entity_info: gameMap.get(r.target_id) || null,
          }
        case 'character':
          return {
            ...r,
            entity: 'character' as const,
            entity_info: characterMap.get(r.target_id) || null,
          }
        case 'developer':
          return {
            ...r,
            entity: 'developer' as const,
            entity_info: developerMap.get(r.target_id) || null,
          }
      }
    })

    return {
      items: result,
      meta: {
        totalItems: total,
        itemCount: result.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }
}
