export class AdAdminItemResDto {
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
  start_at: Date | null
  end_at: Date | null
  created: Date
  updated: Date
}
