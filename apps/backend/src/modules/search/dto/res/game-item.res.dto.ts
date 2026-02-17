export class GameItemResDto {
  id: number
  title_jp: string
  title_zh: string
  title_en: string
  aliases: string[]
  covers: { id: number; sexual: number; violence: number; url: string; dims: number[] }[]
  developers: { developer: { id: number; name: string } }[]
  release_date: string | null
  _formatted?: {
    title_jp?: string
    title_zh?: string
    title_en?: string
    aliases?: string[]
    intro_jp?: string
    intro_zh?: string
    intro_en?: string
  }
}
