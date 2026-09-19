export interface MoyuPublisher {
  id: string
  name: string
  avatar_url: string
  web_url: string
}

export interface MoyuPatchResource {
  id: string
  patch_id: string
  name: string
  storage: 's3' | 'user'
  size: string
  hash: string
  model_name: string
  localization_group_name: string
  note: string
  type: PatchType[]
  language: string[]
  platform: string[]
  download_count: number
  like_count: number
  web_url: string
  created_at: string
  updated_at: string
  publisher: MoyuPublisher
}

export type PatchType =
  | 'manual'
  | 'ai'
  | 'machine_polishing'
  | 'machine'
  | 'save'
  | 'crack'
  | 'fix'
  | 'mod'
  | 'r18'
  | 'decensor'
  | 'image'
  | 'other'
