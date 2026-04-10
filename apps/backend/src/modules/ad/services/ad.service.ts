import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma.service'
import { CacheService } from '../../cache/services/cache.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GetAdListReqDto } from '../dto/req/get-ad-list.req.dto'
import { CreateAdReqDto } from '../dto/req/create-ad.req.dto'
import { UpdateAdReqDto } from '../dto/req/update-ad.req.dto'
import { AdItemResDto } from '../dto/res/ad-item.res.dto'
import { AdAdminItemResDto } from '../dto/res/ad-admin-item.res.dto'
import { PUBLIC_SELECT } from '../constants/ad'

@Injectable()
export class AdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async isUserSponsor(userId: number): Promise<boolean> {
    if (!userId) return false
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { sponsor_expires_at: true },
    })
    return !!user?.sponsor_expires_at && user.sponsor_expires_at > new Date()
  }

  async getAdsByPlacement(placement: string): Promise<AdItemResDto[]> {
    const now = new Date()
    return this.prisma.ad.findMany({
      where: {
        placement: { has: placement },
        enabled: true,
        OR: [{ start_at: null }, { start_at: { lte: now } }],
        AND: [{ OR: [{ end_at: null }, { end_at: { gte: now } }] }],
      },
      orderBy: { sort: 'asc' },
      select: PUBLIC_SELECT,
    })
  }

  async getAdList(dto: GetAdListReqDto): Promise<PaginatedResult<AdAdminItemResDto>> {
    const { page, pageSize, placement, enabled, sortBy = 'id', sortOrder = 'desc' } = dto

    const where: Prisma.AdWhereInput = {}
    if (placement) where.placement = { has: placement }
    if (enabled !== undefined) where.enabled = enabled

    const [items, totalItems] = await Promise.all([
      this.prisma.ad.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ad.count({ where }),
    ])

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
      },
    }
  }

  async getAdDetail(id: number): Promise<AdAdminItemResDto> {
    const ad = await this.prisma.ad.findUnique({ where: { id } })
    if (!ad) {
      throw new ShionBizException(ShionBizCode.AD_NOT_FOUND, 'shion-biz.AD_NOT_FOUND')
    }
    return ad
  }

  async createAd(dto: CreateAdReqDto): Promise<AdAdminItemResDto> {
    const ad = await this.prisma.ad.create({
      data: {
        name: dto.name,
        placement: dto.placement,
        image_zh: dto.image_zh,
        image_ja: dto.image_ja,
        image_en: dto.image_en,
        aspect: dto.aspect,
        link: dto.link,
        exclude_locales: dto.exclude_locales ?? [],
        enabled: dto.enabled ?? true,
        sort: dto.sort ?? 0,
        start_at: dto.start_at ? new Date(dto.start_at) : null,
        end_at: dto.end_at ? new Date(dto.end_at) : null,
      },
    })
    await this.invalidateCache()
    return ad
  }

  async updateAd(id: number, dto: UpdateAdReqDto): Promise<AdAdminItemResDto> {
    await this.getAdDetail(id)

    const data: Prisma.AdUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.placement !== undefined) data.placement = dto.placement
    if (dto.image_zh !== undefined) data.image_zh = dto.image_zh
    if (dto.image_ja !== undefined) data.image_ja = dto.image_ja
    if (dto.image_en !== undefined) data.image_en = dto.image_en
    if (dto.aspect !== undefined) data.aspect = dto.aspect
    if (dto.link !== undefined) data.link = dto.link
    if (dto.exclude_locales !== undefined) data.exclude_locales = dto.exclude_locales
    if (dto.enabled !== undefined) data.enabled = dto.enabled
    if (dto.sort !== undefined) data.sort = dto.sort
    if (dto.start_at !== undefined) data.start_at = dto.start_at ? new Date(dto.start_at) : null
    if (dto.end_at !== undefined) data.end_at = dto.end_at ? new Date(dto.end_at) : null

    const ad = await this.prisma.ad.update({ where: { id }, data })
    await this.invalidateCache()
    return ad
  }

  async deleteAd(id: number): Promise<void> {
    await this.getAdDetail(id)
    await this.prisma.ad.delete({ where: { id } })
    await this.invalidateCache()
  }

  async invalidateCache(): Promise<void> {
    await this.cacheService.delByContains('ad:')
  }
}
