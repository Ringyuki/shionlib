import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { CreateActivityReqDto } from '../dto/create-activity.dto'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { ActivityResDto } from '../dto/res/activity.res.dto'
import { Prisma } from '@prisma/client'

@Injectable()
export class ActivityService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createActivityReqDto: CreateActivityReqDto, tx?: Prisma.TransactionClient) {
    const {
      type,
      user_id,
      comment_id,
      game_id,
      edit_record_id,
      developer_id,
      character_id,
      file_id,
      file_status,
      file_check_status,
      file_size,
      file_name,
    } = createActivityReqDto

    await (tx || this.prismaService).activity.create({
      data: {
        type,
        user_id,
        game_id,
        edit_record_id,
        comment_id,
        developer_id,
        character_id,
        file_id,
        file_status,
        file_check_status,
        file_size,
        file_name,
      },
    })
  }

  async getList(paginationReqDto: PaginationReqDto): Promise<PaginatedResult<ActivityResDto>> {
    const { page, pageSize } = paginationReqDto
    const total = await this.prismaService.activity.count()
    const activities = await this.prismaService.activity.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        created: 'desc',
      },
      select: {
        id: true,
        type: true,
        game: {
          select: {
            id: true,
            title_jp: true,
            title_zh: true,
            title_en: true,
          },
        },
        comment: {
          select: {
            id: true,
            html: true,
          },
        },
        developer: {
          select: {
            id: true,
            name: true,
          },
        },
        character: {
          select: {
            id: true,
            name_jp: true,
            name_zh: true,
            name_en: true,
          },
        },
        file: {
          select: {
            id: true,
            file_name: true,
            file_size: true,
          },
        },
        file_status: true,
        file_check_status: true,
        file_size: true,
        file_name: true,
        user: {
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

    return {
      items: activities.map(a => ({
        id: a.id,
        type: a.type,
        user: a.user,
        game: a.game,
        comment: a.comment,
        developer: a.developer,
        character: a.character,
        file:
          a.file || a.file_name || a.file_size
            ? {
                id: a.file?.id ?? 0,
                file_name: a.file?.file_name ?? a.file_name ?? '',
                file_size: Number(a.file?.file_size ?? a.file_size ?? 0),
                file_status: a.file_status,
                file_check_status: a.file_check_status,
              }
            : undefined,
        created: a.created,
        updated: a.updated,
      })) as unknown as ActivityResDto[],
      meta: {
        totalItems: total,
        itemCount: activities.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }
}
