export interface GalgameMappingEntry {
  id: number
  vndb_id: number | null
  bangumi_game_id: number | null
}

export interface GalgameMappingMeta {
  page: number
  page_size: number
  total_items: number
  item_count: number
  total_pages: number
}

export interface HikarinagiEnvelope<T> {
  success: boolean
  data: T
  meta?: GalgameMappingMeta
  request_id: string
  timestamp: string
}
