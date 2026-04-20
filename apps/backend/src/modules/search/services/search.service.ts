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
    const rawQuery = query.q?.trim() ?? ''
    const q = this.normalizeTag(rawQuery)
    const limit = query.limit ?? 10
    const tags = await this.prisma.tag.findMany({
      where: q
        ? {
            OR: [{ name: { contains: q } }, { aliases: { has: rawQuery } }],
          }
        : undefined,
      orderBy: { count: 'desc' },
      take: limit,
      select: { id: true, name: true, count: true, aliases: true },
    })
    return tags.map(tag => ({
      ...tag,
      display_name: this.pickTagDisplayName(tag.name, tag.aliases, rawQuery),
    }))
  }

  private pickTagDisplayName(name: string, aliases: string[], rawQuery: string) {
    const q = this.normalizeTag(rawQuery)
    if (!q) return name
    return (
      aliases.find(alias => this.normalizeTag(alias) === q) ??
      aliases.find(alias => this.normalizeTag(alias).includes(q)) ??
      name
    )
  }

  private normalizeTag(raw: string) {
    return raw.toLowerCase().trim().replace(/\s+/g, ' ')
  }
}
