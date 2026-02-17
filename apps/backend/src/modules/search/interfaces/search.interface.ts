import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { IndexedGame } from './index.interface'
import { UserContentLimit } from '../../user/interfaces/user.interface'

export interface SearchQuery extends PaginationReqDto {
  q: string
  content_limit?: number
}

export interface SearchEngine {
  upsertGame(doc: IndexedGame): Promise<void>
  bulkUpsertGames(docs: IndexedGame[]): Promise<void>
  deleteGame(id: number): Promise<void>
  deleteAllGames(): Promise<void>
  searchGames(query: SearchQuery, content_limit?: UserContentLimit): Promise<PaginatedResult<any>>
  searchGameTags(query: string, limit?: number): Promise<string[]>
}

export const SEARCH_ENGINE = 'SEARCH_ENGINE'
