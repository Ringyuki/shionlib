import { Platform } from '@/interfaces/game/game.interface'

export interface GameScalar {
  id: number
  b_id: string
  v_id: string
  title_jp: string
  title_zh: string
  title_en: string
  platform: Platform[]
  aliases: string[]
  intro_jp: string
  intro_zh: string
  intro_en: string
  release_date: string
  release_date_tba: boolean
  extra_info: ExtraInfo[]
  tags: string[]
  staffs: Staff[]
  status: number
  nsfw: boolean
  views: number
  type: string
}

export interface DeveloperScalar {
  id: number
  b_id: string
  v_id: string
  name: string
  aliases: string[]
  intro_jp: string
  intro_zh: string
  intro_en: string
  extra_info: ExtraInfo[]
  logo: string
  website: string
}

export interface CharacterScalar {
  id: number
  b_id: string
  v_id: string
  name_jp: string
  name_zh: string
  name_en: string
  intro_jp: string
  intro_zh: string
  intro_en: string
  aliases: string[]
  image: string
  blood_type: string
  height: number
  weight: number
  bust: number
  waist: number
  hips: number
  cup: string
  age: number
  birthday: string
  gender: string
}

export interface ExtraInfo {
  key: string
  value: string
}

export interface Staff {
  name: string
  role: string
}
