import { Controller, Get, Query, Req } from '@nestjs/common'
import { SearchService } from '../services/search.service'
import { SearchGamesReqDto, SearchGameTagsReqDto } from '../dto/req/search.req.dto'
import { SearchAnalyticsService } from '../services/analytics.service'
import { Queue } from 'bull'
import { InjectQueue } from '@nestjs/bull'
import { SEARCH_ANALYTICS_QUEUE } from '../constants/analytics'
import { GetTrendingReqDto } from '../dto/req/get-trending.req.dto'
import { GetSuggestionsReqDto } from '../dto/req/get-suggestions.req.dto'
import { SUGG_PREFIX_MIN_LENGTH } from '../constants/analytics'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'

@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly analyticsService: SearchAnalyticsService,
    @InjectQueue(SEARCH_ANALYTICS_QUEUE) private readonly analyticsQueue: Queue,
  ) {}

  @Get('games')
  async searchGames(@Query() query: SearchGamesReqDto, @Req() req: RequestWithUser) {
    if (query.q && query.q.length >= SUGG_PREFIX_MIN_LENGTH)
      this.analyticsQueue.add(SEARCH_ANALYTICS_QUEUE, query.q)
    return this.searchService.searchGames(query, req.user?.content_limit)
  }

  @Get('tags')
  async searchGameTags(@Query() query: SearchGameTagsReqDto) {
    return this.searchService.searchGameTags(query)
  }

  @Get('trending')
  async getTrending(@Query() query: GetTrendingReqDto) {
    return this.analyticsService.getTrends(query.limit, query.window ? [query.window] : undefined)
  }

  @Get('suggest')
  async getSuggestions(@Query() query: GetSuggestionsReqDto) {
    return this.analyticsService.getSuggestions(query.prefix, query.limit)
  }
}
