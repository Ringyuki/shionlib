export interface UserInterface {
  id: number
  name: string
  avatar: string | null
  cover: string | null
  email: string
  role: number
  lang: UserLang
  content_limit: UserContentLimit
}

export enum UserStatus {
  ACTIVE = 1,
  BANNED = 2,
}

export enum UserLang {
  EN = 'en',
  ZH = 'zh',
  JA = 'ja',
}

export enum UserContentLimit {
  NEVER_SHOW_NSFW_CONTENT = 1,
  SHOW_WITH_SPOILER = 2,
  JUST_SHOW = 3,
}
