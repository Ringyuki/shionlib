export interface BangumiGameItemRes {
  id: number
  date: string
  platform: string
  images: Image
  summary: string
  name: string
  name_cn: string
  tags: Tag[]
  infobox: Infobox[]
  type: number
  rating: Rating
}

export interface Rating {
  rank: number
  total: number
  count: Record<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10', number>
  score: number
}

export interface Image {
  small: string
  grid: string
  large: string
  medium: string
  common: string
}

interface Tag {
  name: string
  count: number
  total_cont: number
}

export interface Infobox {
  key: string
  value: string | Array<InfoboxValueArray>
}

export interface InfoboxValueArray {
  k: string
  v: string
}

export interface BangumiGameCharacterRelationItemRes {
  id: number
  relation: string
  name: string
  images: Image
  actors: Actor[]
}

export interface Actor {
  id: number
  name: string
}

export interface BangumiGamePersonRelationItemRes {
  id: number
  relation: string
  name: string
  images: Image
}
