import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma.service'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GameDownloadSourceService } from '../../game/services/game-download-resource.service'
import { GamePlatform } from '../../game/interfaces/game.interface'
import { PartnerSummaryQueryReqDto } from '../dto/req/partner-download.req.dto'
import {
  PartnerDownloadLinkResDto,
  PartnerDownloadResourceResDto,
  PartnerDownloadSummaryResDto,
} from '../dto/res/partner-download.res.dto'

const AVAILABLE_FILE: Prisma.GameDownloadResourceFileWhereInput = {
  file_status: 3,
  OR: [{ file_check_status: { notIn: [5, 6] } }, { is_virus_false_positive: true }],
}

@Injectable()
export class PartnerDownloadService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly gameDownloadSourceService: GameDownloadSourceService,
  ) {}

  async getSummary(
    dto: PartnerSummaryQueryReqDto,
  ): Promise<PaginatedResult<PartnerDownloadSummaryResDto>> {
    const { page, pageSize } = dto

    const [{ count }] = await this.prismaService.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT g.id
        FROM games g
        JOIN game_download_resources r ON r.game_id = g.id AND r.status = 1
        JOIN game_download_resource_files f ON f.game_download_resource_id = r.id
          AND f.file_status = 3
          AND (f.file_check_status NOT IN (5, 6) OR f.is_virus_false_positive = true)
        WHERE (g.v_id IS NOT NULL AND g.v_id <> '') OR (g.b_id IS NOT NULL AND g.b_id <> '')
        GROUP BY g.id
      ) grouped
    `

    const rows = await this.prismaService.$queryRaw<
      {
        game_id: number
        v_id: string | null
        b_id: string | null
        resource_count: bigint
        file_count: bigint
        total_size: bigint
      }[]
    >`
      SELECT g.id AS game_id,
             g.v_id,
             g.b_id,
             COUNT(DISTINCT r.id)::bigint AS resource_count,
             COUNT(f.id)::bigint AS file_count,
             COALESCE(SUM(f.file_size), 0)::bigint AS total_size
      FROM games g
      JOIN game_download_resources r ON r.game_id = g.id AND r.status = 1
      JOIN game_download_resource_files f ON f.game_download_resource_id = r.id
        AND f.file_status = 3
        AND (f.file_check_status NOT IN (5, 6) OR f.is_virus_false_positive = true)
      WHERE (g.v_id IS NOT NULL AND g.v_id <> '') OR (g.b_id IS NOT NULL AND g.b_id <> '')
      GROUP BY g.id, g.v_id, g.b_id
      ORDER BY g.id
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `

    const totalItems = Number(count)

    return {
      items: rows.map(row => ({
        game_id: row.game_id,
        v_id: row.v_id,
        b_id: row.b_id,
        resource_count: Number(row.resource_count),
        file_count: Number(row.file_count),
        total_size: row.total_size.toString(),
      })),
      meta: {
        totalItems,
        itemCount: rows.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
      },
    }
  }

  async getByExternalId(vId?: string, bId?: string): Promise<PartnerDownloadResourceResDto[]> {
    const or: Prisma.GameWhereInput[] = []
    if (vId) or.push({ v_id: vId })
    if (bId) or.push({ b_id: bId })

    const games = await this.prismaService.game.findMany({
      where: { OR: or },
      select: {
        id: true,
        download_resources: {
          where: { status: 1, files: { some: AVAILABLE_FILE } },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            platform: true,
            language: true,
            simulator: true,
            note: true,
            downloads: true,
            created: true,
            updated: true,
            files: {
              where: AVAILABLE_FILE,
              orderBy: { id: 'asc' },
              select: {
                id: true,
                file_name: true,
                file_size: true,
                file_hash: true,
                hash_algorithm: true,
              },
            },
          },
        },
      },
    })

    return games.flatMap(game =>
      game.download_resources.map(resource => ({
        id: resource.id,
        game_id: game.id,
        platform: resource.platform as GamePlatform[],
        language: resource.language as PartnerDownloadResourceResDto['language'],
        simulator: resource.simulator ?? null,
        note: resource.note ?? null,
        downloads: resource.downloads,
        files: resource.files.map(file => ({
          id: file.id,
          file_name: file.file_name,
          file_size: file.file_size.toString(),
          file_hash: file.file_hash ?? null,
          hash_algorithm: file.hash_algorithm ?? null,
        })),
        created: resource.created.toISOString(),
        updated: resource.updated.toISOString(),
      })),
    )
  }

  async issueLink(fileId: number): Promise<PartnerDownloadLinkResDto> {
    return await this.gameDownloadSourceService.issueLink(fileId)
  }
}
