import { WalkthroughStatus } from '../req/create-walkthrough.req.dto'

export class WalkthroughListItemResDto {
  id: number
  title: string
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
