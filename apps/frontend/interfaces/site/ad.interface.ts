export interface Ad {
  id: number
  image_zh: string
  image_ja: string | null
  image_en: string | null
  aspect: string
  link: string
  exclude_locales: string[]
}
