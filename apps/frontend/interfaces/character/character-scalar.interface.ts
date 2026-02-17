export interface CharacterScalar {
  id: number
  b_id: string
  v_id: string
  name_jp: string
  name_zh: string
  name_en: string
  aliases: string[]
  intro_jp: string
  intro_zh: string
  intro_en: string
  image: string
  blood_type: 'a' | 'b' | 'ab' | 'o' | null
  height: number | null
  weight: number | null
  bust: number | null
  waist: number | null
  hips: number | null
  cup: string | null
  age: number | null
  birthday: number[] // [month, day]
  gender: ('m' | 'f' | 'o' | 'a')[]
}
