import { SupportedLocales } from '@/config/i18n/supported'

export interface User {
  id: number
  name: string
  avatar: string
  cover: string
  bio: string
  role: number
  email?: string
  lang: SupportedLocales
  content_limit?: ContentLimit
  status?: UserStatus
}

export interface UserProfile {
  id: number
  name: string
  avatar: string
  cover: string
  bio: string
  role: number
  created: number
  resource_count: number
  comment_count: number
  favorite_count: number
  edit_count: number
  status: UserStatus
}

export interface UserAvatar {
  id: number
  name: string
  avatar: string
}

export enum ContentLimit {
  NEVER_SHOW_NSFW_CONTENT = 1,
  SHOW_WITH_SPOILER = 2,
  JUST_SHOW = 3,
}

export enum UserRole {
  USER = 1,
  ADMIN = 2,
  SUPER_ADMIN = 3,
}

export const userRoleMap: { [key in User['role']]: string } = {
  [UserRole.USER]: 'user',
  [UserRole.ADMIN]: 'admin',
  [UserRole.SUPER_ADMIN]: 'super_admin',
}

// user status: 1 -> active, 2 -> banned
export enum UserStatus {
  ACTIVE = 1,
  BANNED = 2,
}
