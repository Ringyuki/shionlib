import { WalkthroughStatus } from '@prisma/client'

export class WalkthroughItemResDto {
  id: number
  title: string
  lang: string | null
  created: Date
  updated: Date
  edited: boolean
  status: WalkthroughStatus
  game: {
    id: number
    title_jp: string
    title_zh: string
    title_en: string
    intro_jp: string
    intro_zh: string
    intro_en: string
    covers: {
      language: string
      url: string
      type: string
      dims: number[]
      sexual: number
      violence: number
    }[]
  }
  creator: {
    id: number
    name: string
    avatar: string | null
  }
}
