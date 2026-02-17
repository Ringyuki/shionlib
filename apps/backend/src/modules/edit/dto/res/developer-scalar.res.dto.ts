export class DeveloperScalarResDto {
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

class ExtraInfo {
  key: string
  value: string
}
