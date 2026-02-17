import { Injectable } from '@nestjs/common'
import { SearchEngine, SEARCH_ENGINE } from '../interfaces/search.interface'
import { Inject } from '@nestjs/common'
import { SearchGamesReqDto, SearchGameTagsReqDto } from '../dto/req/search.req.dto'
import { UserContentLimit } from '../../user/interfaces/user.interface'

@Injectable()
export class SearchService {
  constructor(@Inject(SEARCH_ENGINE) private readonly searchEngine: SearchEngine) {}

  async searchGames(query: SearchGamesReqDto, content_limit?: UserContentLimit) {
    return this.searchEngine.searchGames(query, content_limit)
  }

  async searchGameTags(query: SearchGameTagsReqDto) {
    return this.searchEngine.searchGameTags(query.q, query.limit)
  }
}
