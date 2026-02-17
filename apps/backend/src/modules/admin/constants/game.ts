import { Game } from '@prisma/client'

export const ADMIN_EDITABLE_GAME_SCALAR_FIELDS: (keyof Partial<Game>)[] = [
  'b_id',
  'v_id',
  'title_jp',
  'title_zh',
  'title_en',
  'aliases',
  'intro_jp',
  'intro_zh',
  'intro_en',
  'release_date',
  'release_date_tba',
  'extra_info',
  'tags',
  'staffs',
  'nsfw',
  'type',
  'platform',
  'status',
] as const
