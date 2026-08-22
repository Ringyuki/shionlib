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

export interface InternalMedia {
  id: number
  src: string
  width: number | null
  height: number | null
  nsfw?: boolean
  sexual?: number
  violence?: number
}

export interface InternalCover {
  votes: number
  language: string | null
  kind: string | null
  media: InternalMedia
}

export interface InternalGalgameDetail {
  id: number
  origin_title: string
  trans_title: string | null
  en_title: string | null
  aliases: string[]
  origin_intro: string | null
  trans_intro: string | null
  en_intro: string | null
  origin_lang: string | null
  adv_type: string | null
  platforms: string[]
  release_date: string | null
  release_date_tbd: boolean
  nsfw: boolean
  covers: InternalCover[]
  images: InternalMedia[]
  steam_apps: { app_id: number }[]
  external_links: { name: string; label: string; url: string }[]
}

export interface InternalGalgameCharacter {
  role: string
  character: {
    id: number
    name: string
    trans_name: string | null
    en_name: string | null
    aliases: string[]
    intro: string | null
    trans_intro: string | null
    en_intro: string | null
    gender: string | null
    blood_type: string | null
    height: number | null
    weight: number | null
    bust: number | null
    waist: number | null
    hips: number | null
    cup: string | null
    age: string | null
    birthday_month: number | null
    birthday_day: number | null
    image: InternalMedia | null
  }
  actors: { id: number; name: string; trans_name: string | null; image: InternalMedia | null }[]
}

export interface InternalGalgameStaff {
  role: string | null
  person: { id: number; name: string; trans_name: string | null; image: InternalMedia | null }
}

export interface InternalGalgameProducer {
  role: string | null
  note: string
  producer: { id: number; name: string; aliases?: string[]; logo: InternalMedia | null }
}

export interface InternalGalgameBundle {
  relations: {
    relation: string
    target_galgame: InternalGalgameCard & { nsfw: boolean }
  }[]
  tags: { tag: { id: number; name: string; aliases: string[]; count: number } }[]
  galgame: InternalGalgameDetail
  characters: InternalGalgameCharacter[]
  staff: InternalGalgameStaff[]
  producers: InternalGalgameProducer[]
}

export interface InternalGalgameCard {
  id: number
  origin_title: string
  trans_title: string | null
  en_title?: string | null
  origin_lang?: string | null
  aliases?: string[]
  adv_type?: string | null
  origin_intro?: string | null
  trans_intro?: string | null
  en_intro?: string | null
  nsfw: boolean
  release_date: string | null
  release_date_tbd: boolean
  max_cover_sexual: number
  covers: InternalCover[]
  developer: { id: number; name: string } | null
}

export interface InternalProducerListItem {
  id: number
  name: string
  aliases: string[]
  logo: InternalMedia | null
  works_count: number
}

export interface HikarinagiGalgameIdsQuery {
  producer_id?: number
  character_id?: number
  content_limit?: number
  tags?: string[]
  exclude_tags?: string[]
  platforms?: string[]
  release_periods?: string[]
  released_after?: string
  released_before?: string
  sort_order?: 'asc' | 'desc'
  exclude_rated_covers?: boolean
}
