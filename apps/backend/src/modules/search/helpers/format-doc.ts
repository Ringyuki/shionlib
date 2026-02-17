import { GameData } from '../../../modules/game/interfaces/game.interface'
import { IndexedGame } from '../interfaces/index.interface'
import { Prisma } from '@prisma/client'

export const rawDataQuery: Prisma.GameSelect = {
  id: true,
  title_jp: true,
  title_zh: true,
  title_en: true,
  aliases: true,
  intro_jp: true,
  intro_zh: true,
  intro_en: true,
  tags: true,
  platform: true,
  nsfw: true,
  release_date: true,
  staffs: true,
  covers: {
    select: { id: true, language: true, sexual: true, violence: true, url: true, dims: true },
  },
  images: { select: { id: true, sexual: true, violence: true, url: true, dims: true } },
  developers: {
    select: {
      role: true,
      developer: { select: { id: true, name: true, aliases: true } },
    },
  },
  characters: {
    select: {
      actor: true,
      character: {
        select: {
          name_jp: true,
          name_en: true,
          name_zh: true,
          aliases: true,
          intro_jp: true,
          intro_en: true,
          intro_zh: true,
        },
      },
    },
  },
}

export const formatDoc = (g: GameData) => {
  const maxCoverSexual = Math.max(0, ...g.covers.map(c => c.sexual ?? 0))

  const developers = g.developers.map(d => ({
    id: d.developer.id as number,
    name: d.developer.name,
    role: d.role ?? undefined,
    aliases: d.developer.aliases,
  }))
  const developers_names = g.developers.map(d => d.developer.name).filter((s): s is string => !!s)
  const developers_aliases = g.developers.flatMap(d => d.developer.aliases ?? [])

  const character_actors = g.characters.map(c => c.actor).filter((s): s is string => !!s)
  const character_names_jp = g.characters
    .map(c => c.character.name_jp)
    .filter((s): s is string => !!s)
  const character_names_en = g.characters
    .map(c => c.character.name_en)
    .filter((s): s is string => !!s)
  const character_names_zh = g.characters
    .map(c => c.character.name_zh)
    .filter((s): s is string => !!s)
  const character_aliases = g.characters.flatMap(c => c.character.aliases ?? [])
  const character_intros_jp = g.characters
    .map(c => c.character.intro_jp)
    .filter((s): s is string => !!s)
  const character_intros_en = g.characters
    .map(c => c.character.intro_en)
    .filter((s): s is string => !!s)
  const character_intros_zh = g.characters
    .map(c => c.character.intro_zh)
    .filter((s): s is string => !!s)

  const staffsArray: string[] = Array.isArray(g.staffs) ? (g.staffs as unknown as string[]) : []

  const doc: IndexedGame = {
    id: g.id,
    title_jp: g.title_jp || undefined,
    title_zh: g.title_zh || undefined,
    title_en: g.title_en || undefined,
    aliases: g.aliases || undefined,
    intro_jp: g.intro_jp || undefined,
    intro_zh: g.intro_zh || undefined,
    intro_en: g.intro_en || undefined,
    tags: g.tags || undefined,
    platform: g.platform || undefined,
    nsfw: g.nsfw ?? undefined,
    covers: (g.covers as any) || undefined,
    images: (g.images as any) || undefined,
    max_cover_sexual: maxCoverSexual,
    release_date: g.release_date ? g.release_date.toISOString() : null,
    developers: developers,
    developers_names,
    developers_aliases,
    character_actors,
    character_names_jp,
    character_names_en,
    character_names_zh,
    character_aliases,
    character_intros_jp,
    character_intros_en,
    character_intros_zh,
    staffs: staffsArray,
  }
  return doc
}
