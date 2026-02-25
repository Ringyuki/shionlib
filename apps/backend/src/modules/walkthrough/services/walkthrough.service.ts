import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { LexicalRendererService } from '../../render/services/lexical-renderer.service'
import { CreateWalkthroughReqDto } from '../dto/req/create-walkthrough.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { SerializedEditorState } from 'lexical'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { UpdateWalkthroughReqDto } from '../dto/req/update-walkthrough.req.dto'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { Prisma, WalkthroughStatus } from '@prisma/client'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { WalkthroughListItemResDto } from '../dto/res/walkthrough-list.res.dto'

const WALKTHROUGH_SELECT = {
  id: true,
  game: {
    select: {
      id: true,
      title_jp: true,
      title_zh: true,
      title_en: true,
    },
  },
  title: true,
  html: true,
  created: true,
  updated: true,
  edited: true,
  status: true,
  creator: {
    select: {
      id: true,
      name: true,
      avatar: true,
    },
  },
}

@Injectable()
export class WalkthroughService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderService: LexicalRendererService,
  ) {}

  async create(dto: CreateWalkthroughReqDto, req: RequestWithUser) {
    const game = await this.prisma.game.findUnique({
      where: { id: dto.game_id },
      select: { id: true },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    const html = await this.renderService.toHtml(dto.content as SerializedEditorState)
    const walkthrough = await this.prisma.walkthrough.create({
      data: {
        game_id: dto.game_id,
        title: dto.title,
        content: dto.content,
        status: dto.status,
        creator_id: req.user.sub,
        html,
      },
      select: WALKTHROUGH_SELECT,
    })

    return walkthrough
  }

  async update(id: number, dto: UpdateWalkthroughReqDto, req: RequestWithUser) {
    const walkthrough = await this.prisma.walkthrough.findFirst({
      where: { id, status: { not: WalkthroughStatus.DELETED } },
    })
    if (!walkthrough) {
      throw new ShionBizException(ShionBizCode.WALKTHROUGH_NOT_FOUND)
    }
    if (walkthrough.creator_id !== req.user.sub && req.user.role < ShionlibUserRoles.ADMIN) {
      throw new ShionBizException(ShionBizCode.WALKTHROUGH_NOT_OWNER)
    }

    const html = await this.renderService.toHtml(dto.content as SerializedEditorState)
    const updated = await this.prisma.walkthrough.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        status: dto.status,
        html,
      },
      select: WALKTHROUGH_SELECT,
    })

    return updated
  }

  async getById(id: number, withContent = false, req: RequestWithUser) {
    const walkthrough = await this.prisma.walkthrough.findFirst({
      where: { id, status: { not: WalkthroughStatus.DELETED } },
      select: {
        ...WALKTHROUGH_SELECT,
        content: withContent,
      },
    })
    if (!walkthrough) {
      throw new ShionBizException(ShionBizCode.WALKTHROUGH_NOT_FOUND)
    }
    if (
      walkthrough.status !== WalkthroughStatus.PUBLISHED &&
      walkthrough.creator.id !== req.user.sub &&
      req.user.role < ShionlibUserRoles.ADMIN
    ) {
      throw new ShionBizException(ShionBizCode.WALKTHROUGH_NOT_OWNER)
    }
    return walkthrough
  }

  async delete(id: number, req: RequestWithUser) {
    const walkthrough = await this.prisma.walkthrough.findFirst({
      where: { id, status: { not: WalkthroughStatus.DELETED } },
    })
    if (!walkthrough) {
      throw new ShionBizException(ShionBizCode.WALKTHROUGH_NOT_FOUND)
    }
    if (walkthrough.creator_id !== req.user.sub && req.user.role < ShionlibUserRoles.ADMIN) {
      throw new ShionBizException(ShionBizCode.WALKTHROUGH_NOT_OWNER)
    }
    await this.prisma.walkthrough.update({
      where: { id },
      data: { status: WalkthroughStatus.DELETED },
    })
  }

  async getListByGameId(
    gameId: number,
    paginationReqDto: PaginationReqDto,
    req: RequestWithUser,
  ): Promise<PaginatedResult<WalkthroughListItemResDto>> {
    const { page, pageSize } = paginationReqDto
    const where: Prisma.WalkthroughWhereInput & { AND?: Prisma.WalkthroughWhereInput[] } = {
      game_id: gameId,
      AND: [],
    }

    if (req.user.role > ShionlibUserRoles.USER) {
      where.AND!.push({
        status: { in: [WalkthroughStatus.PUBLISHED, WalkthroughStatus.DRAFT] },
      })
    } else if (req.user.sub) {
      where.AND!.push({
        status: { not: WalkthroughStatus.DELETED },
        OR: [{ status: WalkthroughStatus.PUBLISHED }, { creator_id: req.user.sub }],
      })
    } else {
      where.AND!.push({
        status: WalkthroughStatus.PUBLISHED,
      })
    }

    const total = await this.prisma.walkthrough.count({ where })
    const walkthroughs = await this.prisma.walkthrough.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        created: 'desc',
      },
      select: {
        id: true,
        title: true,
        created: true,
        updated: true,
        edited: true,
        status: true,
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    return {
      items: walkthroughs as unknown as WalkthroughListItemResDto[],
      meta: {
        totalItems: total,
        itemCount: walkthroughs.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }
}
