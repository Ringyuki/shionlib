import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { AdminGameListReqDto } from '../dto/req/game-list.req.dto'
import { AdminCharacterListReqDto, AdminDeveloperListReqDto } from '../dto/req/content-list.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { AdminGameItemResDto } from '../dto/res/admin-game-item.res.dto'
import { AdminCharacterItemResDto } from '../dto/res/admin-character-item.res.dto'
import { AdminDeveloperItemResDto } from '../dto/res/admin-developer-item.res.dto'
import { GameDownloadResourceReportService } from '../../game/services/game-download-resource-report.service'
import { GetDownloadResourceReportListReqDto } from '../dto/req/download-resource-report-list.req.dto'
import { ReviewGameDownloadSourceReportReqDto } from '../dto/req/review-game-download-source-report.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { MalwareScanCaseService } from '../../security/services/malware-scan-case.service'
import { GetMalwareScanCaseListReqDto } from '../../security/dto/req/get-malware-scan-case-list.req.dto'
import { ReviewMalwareScanCaseReqDto } from '../../security/dto/req/review-malware-scan-case.req.dto'
import { AdminGameService } from './admin-game.service'

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminGameService: AdminGameService,
    private readonly gameDownloadResourceReportService: GameDownloadResourceReportService,
    private readonly malwareScanCaseService: MalwareScanCaseService,
  ) {}

  async getGameList(query: AdminGameListReqDto): Promise<PaginatedResult<AdminGameItemResDto>> {
    const { page, pageSize, search, sortBy = 'id', sortOrder = 'desc', status } = query

    const where: any = {}

    if (status !== undefined) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { title_jp: { contains: search, mode: 'insensitive' } },
        { title_zh: { contains: search, mode: 'insensitive' } },
        { title_en: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title_jp: true,
          title_zh: true,
          title_en: true,
          status: true,
          views: true,
          downloads: true,
          nsfw: true,
          created: true,
          updated: true,
          covers: {
            take: 1,
            select: { url: true },
          },
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.game.count({ where }),
    ])

    return {
      items: items.map(item => ({
        ...item,
        cover: item.covers[0]?.url,
      })),
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async updateGameStatus(gameId: number, status: number): Promise<void> {
    await this.adminGameService.updateStatus(gameId, status)
  }

  async editGameScalar(gameId: number, payload: Record<string, any>): Promise<void> {
    await this.adminGameService.editScalar(gameId, payload)
  }

  async deleteGame(gameId: number): Promise<void> {
    await this.adminGameService.deleteById(gameId)
  }

  async addGameToRecentUpdate(gameId: number): Promise<void> {
    await this.adminGameService.addToRecentUpdate(gameId)
  }

  async removeGameFromRecentUpdate(gameId: number): Promise<void> {
    await this.adminGameService.removeFromRecentUpdate(gameId)
  }

  async getCharacterList(
    query: AdminCharacterListReqDto,
  ): Promise<PaginatedResult<AdminCharacterItemResDto>> {
    const { page, pageSize, search, sortBy = 'id', sortOrder = 'desc' } = query

    const where: any = {}

    if (search) {
      where.OR = [
        { name_jp: { contains: search, mode: 'insensitive' } },
        { name_zh: { contains: search, mode: 'insensitive' } },
        { name_en: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      this.prisma.gameCharacter.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name_jp: true,
          name_zh: true,
          name_en: true,
          image: true,
          gender: true,
          created: true,
          updated: true,
          _count: {
            select: { games: true },
          },
        },
      }),
      this.prisma.gameCharacter.count({ where }),
    ])

    return {
      items: items.map(item => ({
        id: item.id,
        name_jp: item.name_jp,
        name_zh: item.name_zh,
        name_en: item.name_en,
        image: item.image ?? undefined,
        gender: item.gender,
        gamesCount: item._count.games,
        created: item.created,
        updated: item.updated,
      })),
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getDeveloperList(
    query: AdminDeveloperListReqDto,
  ): Promise<PaginatedResult<AdminDeveloperItemResDto>> {
    const { page, pageSize, search, sortBy = 'id', sortOrder = 'desc' } = query

    const where: any = {}

    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const [items, total] = await Promise.all([
      this.prisma.gameDeveloper.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          logo: true,
          created: true,
          updated: true,
          _count: {
            select: { games: true },
          },
        },
      }),
      this.prisma.gameDeveloper.count({ where }),
    ])

    return {
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        logo: item.logo ?? undefined,
        gamesCount: item._count.games,
        created: item.created,
        updated: item.updated,
      })),
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getDownloadResourceReportList(query: GetDownloadResourceReportListReqDto) {
    return this.gameDownloadResourceReportService.getList(query)
  }

  async getDownloadResourceReportDetail(id: number) {
    return this.gameDownloadResourceReportService.getById(id)
  }

  async reviewDownloadResourceReport(
    id: number,
    dto: ReviewGameDownloadSourceReportReqDto,
    actor: RequestWithUser['user'],
  ) {
    return this.gameDownloadResourceReportService.review(id, dto, actor)
  }

  async getMalwareScanCaseList(query: GetMalwareScanCaseListReqDto) {
    return this.malwareScanCaseService.getList(query)
  }

  async getMalwareScanCaseDetail(id: number) {
    return this.malwareScanCaseService.getById(id)
  }

  async reviewMalwareScanCase(
    id: number,
    dto: ReviewMalwareScanCaseReqDto,
    actor: RequestWithUser['user'],
  ) {
    return this.malwareScanCaseService.review(id, dto, actor)
  }
}
