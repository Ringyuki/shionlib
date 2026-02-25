import { WalkthroughStatus } from '../req/create-walkthrough.req.dto'

export class WalkthroughResDto {
  id: number
  game: {
    id: number
    title_jp: string
    title_zh: string
    title_en: string
  }
  title: string
  html: string
  lang?: string | null
  created: Date
  updated: Date
  edited: boolean
  status: WalkthroughStatus
  creator: {
    id: number
    name: string
    avatar: string | null
  }
}
