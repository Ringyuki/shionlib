import { Infobox, Image } from './game-item.res.interface'

export interface BangumiCharacterItemRes {
  id: number
  gender: string
  summary: string
  name: string
  images: Image
  infobox: Infobox[]
}
