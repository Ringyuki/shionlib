import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'

export interface AdminGameListItem {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
  cover?: string
  status: number
  views: number
  downloads: number
  nsfw: boolean
  created: string
  updated: string
  creator: {
    id: number
    name: string
  }
}

export type AdminGameListResult = PaginatedResponse<AdminGameListItem>

export interface AdminGameListQuery {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  status?: number
}

export interface AdminCharacterListItem {
  id: number
  name_jp: string
  name_zh: string | null
  name_en: string | null
  image?: string
  gender: string[]
  gamesCount: number
  created: string
  updated: string
}

export type AdminCharacterListResult = PaginatedResponse<AdminCharacterListItem>

export interface AdminCharacterListQuery {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface AdminDeveloperListItem {
  id: number
  name: string
  logo?: string
  gamesCount: number
  created: string
  updated: string
}

export type AdminDeveloperListResult = PaginatedResponse<AdminDeveloperListItem>

export interface AdminDeveloperListQuery {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
