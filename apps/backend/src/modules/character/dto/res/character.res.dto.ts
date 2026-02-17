import {
  GameCharacterBloodType,
  GameCharacterGender,
} from '../../../game/interfaces/game.interface'

export class CharacterResDto {
  id: number
  b_id: string | null
  v_id: string | null
  name_jp: string | null
  name_zh: string | null
  name_en: string | null
  aliases: string[]
  intro_jp: string | null
  intro_zh: string | null
  intro_en: string | null
  image: string | null
  blood_type: GameCharacterBloodType | null
  height: number | null
  weight: number | null
  bust: number | null
  waist: number | null
  hips: number | null
  cup: string | null
  age: number | null
  birthday: number[] | null // [month, day]
  gender: GameCharacterGender[] | null
}
