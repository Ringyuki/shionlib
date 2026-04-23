import { Image, Infobox } from './game-item.res.interface'

export interface BangumiProducerItemRes {
  id: number
  name: string
  summary: string
  images?: Image
  infobox: Infobox[]
}
