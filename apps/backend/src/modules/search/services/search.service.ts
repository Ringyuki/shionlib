import { Injectable, Inject } from '@nestjs/common'
import { SearchEngine, SEARCH_ENGINE } from '../interfaces/search.interface'
import { SearchGamesReqDto, SearchGameTagsReqDto } from '../dto/req/search.req.dto'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { PrismaService } from '../../../prisma.service'

@Injectable()
export class SearchService {
  constructor(
    @Inject(SEARCH_ENGINE) private readonly searchEngine: SearchEngine,
    private readonly prisma: PrismaService,
  ) {}

  async searchGames(query: SearchGamesReqDto, content_limit?: UserContentLimit) {
    return this.searchEngine.searchGames(query, content_limit)
  }

  async searchGameTags(query: SearchGameTagsReqDto) {
    const q = query.q?.toLowerCase().trim() ?? ''
    const limit = query.limit ?? 10
    return this.prisma.tag.findMany({
      where: q ? { name: { contains: q } } : undefined,
      orderBy: { count: 'desc' },
      take: limit,
      select: { name: true, count: true },
    })
  }
}
