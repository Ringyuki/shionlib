export class AdminGameItemResDto {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
  cover?: string
  status: number
  views: number
  downloads: number
  nsfw: boolean
  created: Date
  updated: Date
  creator: {
    id: number
    name: string
  }
}
