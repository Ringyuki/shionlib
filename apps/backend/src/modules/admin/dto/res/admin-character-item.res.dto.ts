export class AdminCharacterItemResDto {
  id: number
  name_jp: string
  name_zh: string | null
  name_en: string | null
  image?: string
  gender: string[]
  gamesCount: number
  created: Date
  updated: Date
}
