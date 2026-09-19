export interface MoyuPublisher {
  object: 'user'
  id: string
  name: string
  avatar_url: string
  web_url: string
}

export interface MoyuPatchResource {
  object: 'patch_resource'
  id: string
  patch_id: string
  name: string
  storage: 's3' | 'user'
  size: string
  hash: string
  model_name: string
  localization_group_name: string
  note: string
  type: string[]
  language: string[]
  platform: string[]
  download_count: number
  like_count: number
  web_url: string
  created_at: string
  updated_at: string
  publisher?: MoyuPublisher
}

export interface MoyuPatch {
  object: 'patch'
  id: string
  vndb_id: string
  web_url: string
  resources?: MoyuPatchResource[]
}

export interface MoyuPatchList {
  object: 'list'
  items: MoyuPatch[]
  next_cursor: string | null
  total: number | null
  missing?: string[]
}
