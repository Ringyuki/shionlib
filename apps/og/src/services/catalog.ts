import { z } from 'zod'
import { fetchData } from './backend'

const list = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform(items => items ?? [])

const text = z
  .string()
  .nullish()
  .transform(value => value ?? '')

const cover = z.object({
  type: text,
  url: z.string(),
  dims: list(z.number()),
  sexual: z.number().default(0),
  violence: z.number().default(0),
  masked: z.boolean().default(false),
})

const credit = z.object({
  developer: z.object({ id: z.number(), name: z.string() }),
})

const titled = {
  title_jp: text,
  title_zh: text,
  title_en: text,
}

const gameHeader = z.object({
  id: z.number(),
  ...titled,
  covers: list(cover),
  developers: list(credit),
  release_date: z.string().nullish(),
})

const resource = z.object({
  platform: list(z.string()),
  language: list(z.string()),
  translators: list(z.object({ name: z.string() })),
  form: z.string().nullish(),
  downloads: z.number().default(0),
  files: list(z.object({ file_size: z.number() })),
})

const resourceDetail = z.object({
  game: gameHeader,
  resource,
})

const walkthrough = z.object({
  game_id: z.number(),
  lang: z.string().nullish(),
  updated: z.string(),
  creator: z.object({ name: z.string() }),
  routes: list(z.object({ name: text })),
})

const character = z.object({
  name_jp: text,
  name_zh: text,
  name_en: text,
  image: z.string().nullish(),
  gender: list(z.string()),
  age: z.number().nullish(),
  appearances: list(z.object({ game_id: z.number(), role: text, actor: z.string().nullish() })),
})

const developer = z.object({
  name: z.string(),
  aliases: list(z.string()),
  logo: z.string().nullish(),
})

const translator = z.object({
  name: z.string(),
  aliases: list(z.string()),
})

const profile = z.object({
  name: z.string(),
  avatar: z.string().nullish(),
  cover: z.string().nullish(),
  bio: z.string().nullish(),
  is_admin: z.boolean().default(false),
  is_sponsor: z.boolean().default(false),
  resource_count: z.number().default(0),
  comment_count: z.number().default(0),
  walkthrough_count: z.number().default(0),
})

const gameList = z.object({
  items: list(z.object({ id: z.number(), ...titled, covers: list(cover) })),
  meta: z.object({ totalItems: z.number() }),
})

export type Cover = z.output<typeof cover>
export type Titled = z.output<z.ZodObject<typeof titled>>
export type GameHeader = z.output<typeof gameHeader>
export type Resource = z.output<typeof resource>
export type ResourceDetail = z.output<typeof resourceDetail>
export type Walkthrough = z.output<typeof walkthrough>
export type Character = z.output<typeof character>
export type Developer = z.output<typeof developer>
export type Translator = z.output<typeof translator>
export type Profile = z.output<typeof profile>
export type GameList = z.output<typeof gameList>

export const fetchGameHeader = (id: number) => fetchData(`/game/${id}/header`, gameHeader)

export const fetchGameResources = (id: number) =>
  fetchData(`/game/${id}/download-source`, list(resource))

export const fetchResource = (id: number) =>
  fetchData(`/game/download-source/${id}`, resourceDetail)

export const fetchWalkthrough = (id: number) => fetchData(`/walkthrough/${id}`, walkthrough)

export const fetchCharacter = (id: number) => fetchData(`/character/${id}`, character)

export const fetchDeveloper = (id: number) => fetchData(`/developer/${id}`, developer)

export const fetchTranslator = (id: number) => fetchData(`/translator/${id}`, translator)

export const fetchProfile = (id: number) => fetchData(`/user/${id}`, profile)

export function fetchGames(query: Record<string, string | number>): Promise<GameList> {
  const search = new URLSearchParams(
    Object.entries(query).map(([key, value]): [string, string] => [key, String(value)]),
  )
  return fetchData(`/game/list?${search.toString()}`, gameList)
}
