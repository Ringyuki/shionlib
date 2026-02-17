import { ExtraInfo } from '../game/game.interface'

export interface Developer {
  id: number
  name: string
  aliases: string[]
  logo: string
  intro_jp: string
  intro_zh: string
  intro_en: string
  website: string
  extra_info: ExtraInfo[]
  parent_developer: {
    id: number
    name: string
    aliases: string[]
  }
  works_count: number
}

export interface DeveloperSearchResult {
  id: number
  name: string
  aliases: string[]
}
