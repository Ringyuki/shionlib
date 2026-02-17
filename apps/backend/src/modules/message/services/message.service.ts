import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { SendMessageReqDto } from '../dto/req/send-message.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GetMessagesReqDto } from '../dto/req/get-messages.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { MessageListItemResDto } from '../dto/res/message-list.res.dto'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { Prisma } from '@prisma/client'
import { MessageNotifier } from './message-notifier.service'
import { MessageTone, MessageType } from '../dto/req/send-message.req.dto'

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageNotifier: MessageNotifier,
  ) {}

  async send(sendMessageReqDto: SendMessageReqDto, tx?: Prisma.TransactionClient) {
    const {
      type,
      tone,
      title,
      content,
      link_text,
      link_url,
      external_link,
      meta,
      comment_id,
      game_id,
      sender_id,
      receiver_id,
    } = sendMessageReqDto

    if (type === MessageType.COMMENT_LIKE || type === MessageType.COMMENT_REPLY) {
      if (receiver_id === sender_id) {
        return
      }
    }

    const message = await (tx || this.prisma).message.create({
      data: {
        type,
        tone,
        title,
        content,
        link_text,
        link_url,
        external_link,
        meta: meta as Prisma.InputJsonValue,
        comment_id,
        game_id,
        sender_id,
        receiver_id,
      },
      select: {
        id: true,
        title: true,
        type: true,
        tone: true,
        created: true,
      },
    })
    this.messageNotifier.notifyNewMessage(receiver_id, {
      id: message.id,
      title: message.title,
      type: message.type as MessageType,
      tone: message.tone as MessageTone,
      created: message.created,
    })
  }

  async getList(
    paginationReqDto: GetMessagesReqDto,
    req: RequestWithUser,
  ): Promise<PaginatedResult<MessageListItemResDto>> {
    const { page, pageSize, unread, type } = paginationReqDto

    const where: Prisma.MessageWhereInput = {
      receiver_id: req.user.sub,
      ...(unread !== undefined ? { read: !unread } : {}),
      ...(type ? { type } : {}),
    }
    const total = await this.prisma.message.count({ where })
    const messages = await this.prisma.message.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        created: 'desc',
      },
      where,
      select: {
        id: true,
        type: true,
        tone: true,
        title: true,
        receiver: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        read: true,
        read_at: true,
        created: true,
        updated: true,
      },
    })

    return {
      items: messages as unknown as MessageListItemResDto[],
      meta: {
        totalItems: total,
        itemCount: messages.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getUnreadCount(req: RequestWithUser) {
    return await this.prisma.message.count({
      where: {
        receiver_id: req.user.sub,
        read: false,
      },
    })
  }

  async getById(id: number, req: RequestWithUser) {
    const message = await this.prisma.$transaction(async tx => {
      const message = await this.prisma.message.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          tone: true,
          title: true,
          content: true,
          link_text: true,
          link_url: true,
          external_link: true,
          meta: true,
          comment: {
            select: {
              id: true,
              html: true,
            },
          },
          game: {
            select: {
              id: true,
              title_zh: true,
              title_en: true,
              title_jp: true,
            },
          },
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          read: true,
          read_at: true,
          created: true,
          updated: true,
        },
      })
      if (!message) {
        throw new ShionBizException(ShionBizCode.MESSAGE_NOT_FOUND, 'shion-biz.MESSAGE_NOT_FOUND')
      }
      if (message.receiver.id !== req.user.sub) {
        throw new ShionBizException(ShionBizCode.MESSAGE_FORBIDDEN, 'shion-biz.MESSAGE_FORBIDDEN')
      }
      await this.markAsRead(id, req, tx)
      return message
    })
    return message
  }

  async markAsRead(id: number, req: RequestWithUser, tx?: Prisma.TransactionClient) {
    await (tx || this.prisma).message.update({
      where: { id, receiver_id: req.user.sub },
      data: { read: true, read_at: new Date() },
    })
    const unread = await this.prisma.message.count({
      where: { receiver_id: req.user.sub, read: false },
    })
    this.messageNotifier.notifyUnreadCount(req.user.sub, unread)
  }

  async markAllAsRead(req: RequestWithUser) {
    await this.prisma.message.updateMany({
      where: { receiver_id: req.user.sub, read: false },
      data: { read: true, read_at: new Date() },
    })
    this.messageNotifier.notifyUnreadCount(req.user.sub, 0)
  }

  async markAllAsUnread(req: RequestWithUser) {
    await this.prisma.message.updateMany({
      where: { receiver_id: req.user.sub, read: true },
      data: { read: false, read_at: null },
    })
    const unread = await this.prisma.message.count({
      where: { receiver_id: req.user.sub, read: false },
    })
    this.messageNotifier.notifyUnreadCount(req.user.sub, unread)
  }
}
