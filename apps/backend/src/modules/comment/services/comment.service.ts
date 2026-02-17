import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { PrismaService } from 'src/prisma.service'
import { Prisma } from '@prisma/client'
import { CreateCommentReqDto } from '../dto/req/create-comment.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { EditCommentReqDto } from '../dto/req/edit-comment.req.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { CommentResDto } from '../dto/res/comment.res.dto'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { LexicalRendererService } from '../../render/services/lexical-renderer.service'
import { SerializedEditorState } from 'lexical'
import { MessageService } from '../../message/services/message.service'
import { MessageTone, MessageType } from '../../message/dto/req/send-message.req.dto'
import {
  MODERATION_QUEUE,
  OMNI_MODERATION_JOB,
} from '../../moderate/constants/moderation.constants'

@Injectable()
export class CommentServices {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly renderService: LexicalRendererService,
    private readonly messageService: MessageService,
    @InjectQueue(MODERATION_QUEUE) private readonly moderationQueue: Queue,
  ) {}

  async createGameComment(game_id: number, dto: CreateCommentReqDto, req: RequestWithUser) {
    const { content, parent_id } = dto

    let root_id: number | null = null
    const result = await this.prismaService.$transaction(async tx => {
      if (parent_id) {
        const parent = await tx.comment.findUnique({
          where: { id: parent_id },
          select: { id: true, game_id: true, root_id: true },
        })
        if (!parent || parent.game_id !== game_id) {
          throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND)
        }
        root_id = parent.root_id ?? parent.id
      }

      const html = await this.renderService.toHtml(content as SerializedEditorState)

      const comment = await tx.comment.create({
        data: {
          content,
          html,
          game_id,
          creator_id: req.user.sub,
          parent_id,
          root_id,
          status: 2,
        },
        select: {
          id: true,
          content: true,
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
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          status: true,
          created: true,
          updated: true,
        },
      })
      if (!root_id) {
        await tx.comment.update({
          where: { id: comment.id },
          data: { root_id: comment.id },
        })
      }
      if (parent_id) {
        await tx.comment.update({
          where: { id: parent_id },
          data: { reply_count: { increment: 1 } },
        })
      }
      if (root_id && root_id !== comment.id) {
        await tx.comment.update({
          where: { id: root_id },
          data: { reply_count: { increment: 1 } },
        })
      }
      return {
        ...comment,
        root_id: root_id || comment.id,
        like_count: 0,
      }
    })

    await this.moderationQueue.add(OMNI_MODERATION_JOB, { commentId: result.id })
    return result
  }

  async editComment(id: number, dto: EditCommentReqDto, req: RequestWithUser) {
    if (!id || id <= 0) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND)
    }
    const { content } = dto
    const existed = await this.prismaService.comment.findUnique({
      where: { id },
    })
    if (!existed) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND)
    }

    if (
      existed.creator_id !== req.user.sub &&
      req.user.role !== ShionlibUserRoles.ADMIN &&
      req.user.role !== ShionlibUserRoles.SUPER_ADMIN
    ) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_OWNER)
    }

    const html = await this.renderService.toHtml(content as SerializedEditorState)

    const comment = await this.prismaService.comment.update({
      where: { id },
      data: { content, html, edited: true, status: 2 },
      select: {
        id: true,
        content: true,
        html: true,
        parent_id: true,
        root_id: true,
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        edited: true,
        status: true,
        created: true,
        updated: true,
      },
    })

    await this.moderationQueue.add(OMNI_MODERATION_JOB, { commentId: id })
    return comment
  }

  async getRaw(id: number, req: RequestWithUser) {
    const comment = await this.prismaService.comment.findUnique({
      where: { id },
      select: {
        id: true,
        content: true,
        creator_id: true,
      },
    })
    if (!comment) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND)
    }
    if (
      comment.creator_id !== req.user.sub &&
      req.user.role !== ShionlibUserRoles.ADMIN &&
      req.user.role !== ShionlibUserRoles.SUPER_ADMIN
    ) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_OWNER)
    }
    return comment
  }

  async deleteComment(id: number, req: RequestWithUser) {
    if (!id || id <= 0) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND)
    }
    const comment = await this.prismaService.comment.findUnique({
      where: { id },
    })
    if (!comment) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND)
    }

    if (
      comment.creator_id !== req.user.sub &&
      req.user.role !== ShionlibUserRoles.ADMIN &&
      req.user.role !== ShionlibUserRoles.SUPER_ADMIN
    ) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_OWNER)
    }

    await this.prismaService.$transaction(async tx => {
      await tx.comment.delete({
        where: { id },
      })
      if (comment.parent_id) {
        await tx.comment.update({
          where: { id: comment.parent_id },
          data: { reply_count: { decrement: 1 } },
        })
      }
      if (comment.root_id && comment.root_id !== comment.id) {
        await tx.comment.update({
          where: { id: comment.root_id },
          data: { reply_count: { decrement: 1 } },
        })
      }
    })
  }

  async getGameComments(
    game_id: number,
    paginationReqDto: PaginationReqDto,
    req: RequestWithUser,
  ): Promise<PaginatedResult<CommentResDto>> {
    const { page, pageSize } = paginationReqDto

    const where: Prisma.CommentWhereInput = {
      OR: [
        { game_id, status: 1 },
        { game_id, creator_id: req.user.sub, status: { not: 3 } },
      ],
    }
    const total = await this.prismaService.comment.count({ where })
    const comments = await this.prismaService.comment.findMany({
      where,
      orderBy: [{ created: 'asc' }],
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
        liked_users: { where: { id: req.user?.sub || 0 }, select: { id: true }, take: 1 },
        _count: { select: { liked_users: true } },
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        edited: true,
        status: true,
        created: true,
        updated: true,
      },
    })

    return {
      items: comments.map(comment => ({
        id: comment.id,
        html: comment.html,
        parent_id: comment.parent_id,
        root_id: comment.root_id,
        reply_count: comment.reply_count,
        parent: {
          id: comment.parent_id,
          html: comment.parent?.html,
          creator: comment.parent?.creator,
        },
        is_liked: comment.liked_users.length > 0,
        like_count: comment._count.liked_users,
        creator: comment.creator,
        edited: comment.edited,
        status: comment.status,
        created: comment.created,
        updated: comment.updated,
      })),
      meta: {
        totalItems: total,
        itemCount: comments.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async likeComment(id: number, req: RequestWithUser) {
    const comment = await this.prismaService.comment.findUnique({
      where: { id },
      select: {
        id: true,
        liked_users: { where: { id: req.user.sub }, select: { id: true }, take: 1 },
        creator_id: true,
        game_id: true,
      },
    })
    if (!comment) {
      throw new ShionBizException(ShionBizCode.COMMENT_NOT_FOUND)
    }

    await this.prismaService.$transaction(async tx => {
      if (comment.liked_users.length > 0) {
        await tx.comment.update({
          where: { id },
          data: { liked_users: { disconnect: { id: req.user.sub } } },
        })
      } else {
        await tx.comment.update({
          where: { id },
          data: { liked_users: { connect: { id: req.user.sub } } },
        })
        await this.messageService.send(
          {
            type: MessageType.COMMENT_LIKE,
            tone: MessageTone.INFO,
            title: 'Messages.Comment.Like.Title',
            content: 'Messages.Comment.Like.Content',
            receiver_id: comment.creator_id,
            comment_id: comment.id,
            game_id: comment.game_id,
            sender_id: req.user.sub,
          },
          tx,
        )
      }
    })
  }
}
