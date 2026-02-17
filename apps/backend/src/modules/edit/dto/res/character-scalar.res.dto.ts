export class CharacterScalarResDto {
  b_id: string
  v_id: string
  name_jp: string
  name_zh: string
  name_en: string
  image: string
  aliases: string[]
  intro_jp: string
  intro_zh: string
  intro_en: string
  blood_type: BloodType
  height: number
  weight: number
  bust: number
  waist: number
  hips: number
  cup: string
  age: number
  birthday: number[] // [month, day]
  gender: Gender[]
}

enum Gender {
  MALE = 'm',
  FEMALE = 'f',
  NON_BINARY = 'o',
  AMBIGUOUS = 'a',
}

enum BloodType {
  A = 'a',
  B = 'b',
  AB = 'ab',
  O = 'o',
}
