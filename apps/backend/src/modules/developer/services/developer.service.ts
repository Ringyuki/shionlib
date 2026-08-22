import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { GetListReqDto } from '../dto/req/get-list.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { DeveloperResDto } from '../dto/res/developer.res.dto'

import { HikarinagiClient } from '../../hikarinagi/clients/hikarinagi.client'
import { mapProducerDetail } from '../../hikarinagi/mappers/galgame-read.mapper'

@Injectable()
export class DeveloperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hikarinagi: HikarinagiClient,
  ) {}

  async getList(dto: GetListReqDto): Promise<PaginatedResult<DeveloperResDto>> {
    const { page, pageSize, q } = dto
    const remote = await this.hikarinagi.producerList({
      page,
      page_size: pageSize,
      search: q || undefined,
    })
    const items = (remote?.items ?? []).map(row => ({
      id: row.id,
      name: row.name,
      aliases: row.aliases,
      logo: row.logo?.src ?? null,
      works_count: row.works_count,
    }))
    const total = remote?.meta.total_items ?? 0

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getById(id: number) {
    const remote = await this.hikarinagi.producer(id)
    if (!remote) {
      throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_NOT_FOUND)
    }

    return { id, h_id: id, ...mapProducerDetail(remote) }
  }

  async deleteById(id: number) {
    const exist = await this.prisma.gameDeveloper.findUnique({
      where: { id },
    })
    if (!exist) {
      throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_NOT_FOUND)
    }
    const existRelations = await this.prisma.gameDeveloperRelation.findMany({
      where: { developer_id: id },
    })
    if (existRelations.length > 0) {
      throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_HAS_RELATIONS)
    }
    const existChilds = await this.prisma.gameDeveloper.findMany({
      where: { parent_developer_id: id },
    })
    if (existChilds.length > 0) {
      throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_HAS_CHILDREN)
    }
    await this.prisma.gameDeveloper.delete({ where: { id } })
  }
}
