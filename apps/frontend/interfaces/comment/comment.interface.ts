export enum CommentStatus {
  VISIBLE = 1,
  HIDDEN = 2,
  DELETED = 3,
}

export interface Comment {
  id: number
  html: string
  parent_id: number | null
  parent?: {
    id: number
    html: string
    creator: {
      id: number
      name: string
      avatar: string
    }
  }
  root_id: number | null
  reply_count: number
  like_count: number
  is_liked: boolean
  game?: {
    title_zh: string
    title_jp: string
    title_en: string
    id: number
  }
  creator: {
    id: number
    name: string
    avatar: string
  }
  edited: boolean
  status: CommentStatus
  created: string
  updated: string
}
