export class CommentResDto {
  id: number
  html: string | null
  parent_id: number | null
  root_id: number | null
  reply_count: number
  is_liked: boolean
  like_count: number
  game?: {
    id: number
    title_jp: string | null
    title_zh: string | null
    title_en: string | null
  }
  creator: {
    id: number
    name: string
    avatar: string | null
  }
  edited: boolean
  status: number
  created: Date
  updated: Date
}
