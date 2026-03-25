import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { CacheService } from '../../cache/services/cache.service'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { SponsorWallItemResDto } from '../dto/res/sponsor-wall-item.res.dto'
import { GetSponsorWallReqDto } from '../dto/req/get-sponsor-wall.req.dto'
import { USER_AVATAR_SELECT, mapUserAvatar } from '../../../shared/constants/user-select.constant'

@Injectable()
export class SponsorWallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getWall(dto: GetSponsorWallReqDto): Promise<PaginatedResult<SponsorWallItemResDto>> {
    const { page, pageSize } = dto

    const [items, totalItems] = await Promise.all([
      this.prisma.sponsorOrder.findMany({
        where: {
          status: 'DONE' as const,
          is_private: false,
        },
        orderBy: { paid_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sponsor_name: true,
          sponsor_message: true,
          user: {
            select: USER_AVATAR_SELECT,
          },
          amount: true,
          paid_at: true,
        },
      }),
      this.prisma.sponsorOrder.count({ where: { status: 'DONE' as const, is_private: false } }),
    ])

    return {
      items: items.map(item => ({
        id: item.id,
        sponsorName: item.sponsor_name,
        message: item.sponsor_message,
        user: item.user ? mapUserAvatar(item.user) : null,
        amount: Number(item.amount),
        paidAt: item.paid_at!,
      })),
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
      },
    }
  }

  async invalidateWallCache(): Promise<void> {
    await this.cacheService.delByContains('sponsor:wall')
  }
}
