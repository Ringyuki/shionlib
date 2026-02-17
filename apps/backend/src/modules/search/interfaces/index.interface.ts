export interface IndexedGame {
  id: number
  title_jp?: string
  title_zh?: string
  title_en?: string
  aliases?: string[]
  intro_jp?: string
  intro_zh?: string
  intro_en?: string
  tags?: string[]
  platform?: string[]
  nsfw?: boolean
  max_cover_sexual?: number
  covers?: { id: number; sexual: number; violence: number; url: string; dims: number[] }[]
  images?: { id: number; sexual: number; violence: number; url: string; dims: number[] }[]
  release_date?: string | null
  developers?: { id: number; name: string; aliases?: string[]; role?: string }[]

  developers_names?: string[]
  developers_aliases?: string[]
  character_names_jp?: string[]
  character_names_en?: string[]
  character_names_zh?: string[]
  character_aliases?: string[]
  character_intros_jp?: string[]
  character_intros_en?: string[]
  character_intros_zh?: string[]
  character_actors?: string[]
  staffs?: string[]
}
