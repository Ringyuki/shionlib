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
  request_id: string
  timestamp: string
}

export interface CatalogEvent {
  id: number
  resource_type: string
  resource_id: number
  kind: 'UPSERT' | 'DELETE' | 'MERGE'
  merged_to_id: number | null
  created_at: string
}

export interface CatalogChanges {
  items: CatalogEvent[]
  latest_id: number
  has_more: boolean
}
