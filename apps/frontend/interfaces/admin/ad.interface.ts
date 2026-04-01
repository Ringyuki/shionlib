export interface AdminAdItem {
  id: number
  name: string
  placement: string[]
  image_zh: string
  image_ja: string | null
  image_en: string | null
  aspect: string
  link: string
  exclude_locales: string[]
  enabled: boolean
  sort: number
  start_at: string | null
  end_at: string | null
  created: string
  updated: string
}

export interface AdminAdListQuery {
  page?: number
  pageSize?: number
  placement?: string
  enabled?: boolean
}

export interface CreateAdPayload {
  name: string
  placement: string[]
  image_zh: string
  image_ja?: string
  image_en?: string
  aspect: string
  link: string
  exclude_locales?: string[]
  enabled?: boolean
  sort?: number
  start_at?: string
  end_at?: string
}

export interface UpdateAdPayload {
  name?: string
  placement?: string[]
  image_zh?: string
  image_ja?: string
  image_en?: string
  aspect?: string
  link?: string
  exclude_locales?: string[]
  enabled?: boolean
  sort?: number
  start_at?: string
  end_at?: string
}
