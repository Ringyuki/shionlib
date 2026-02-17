import {
  GameCharacterBloodType,
  GameCharacterGender,
  GameCharacterRole,
  GameLink,
} from '../../interfaces/game.interface'

export interface VNDBGameItemRes {
  id: string
  titles: Title[]
  aliases: string[]
  released: string
  description: string
  platforms: string[]
  screenshots: Screenshot[]
  va: VA[]
  developers: Developer[]
  extlinks: GameLink[]
  image: Image
  olang: string

  rating: number
  length_votes: number
  average: number
  votecount: number
}

export type VNDBGameItemRating = Pick<VNDBGameItemRes, 'rating' | 'average' | 'votecount'>

interface Title {
  lang: string
  latin: string
  main: boolean
  title: string
}

interface Screenshot {
  url: string
  dims: number[]
  sexual: number
  violence: number
}

interface VA {
  character: Character
}

interface Character {
  id: string
  name: string
  original: string
  aliases: string[]
  description: string
  image: Image
  blood_type: GameCharacterBloodType
  height: number
  weight: number
  bust: number
  waist: number
  hips: number
  cup: string
  age: number
  birthday: number[] // [month, day]
  gender: GameCharacterGender[]
  vns: Array<{ role: GameCharacterRole; id: string }>
}

interface Image {
  url: string
  dims: number[]
  sexual: number
  violence: number
}

interface Developer {
  id: string
  name: string
  original: string
  aliases: string[]
  description: string
  // "co" for company, "in" for individual and "ng" for amateur group.
  type: 'co' | 'in' | 'ng'
  extlinks: Extlink[]
}

interface Extlink {
  label: string
  name: string
  url: string
}
