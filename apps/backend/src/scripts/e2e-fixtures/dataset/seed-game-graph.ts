import {
  GameCharacterBloodType,
  GameCharacterGender,
  GameCharacterRole,
  Prisma,
  PrismaClient,
} from '@prisma/client'
import {
  game_character_relations as fixture_game_character_relations,
  game_characters as fixture_game_characters,
  game_covers as fixture_game_covers,
  game_developer_relations as fixture_game_developer_relations,
  game_developers as fixture_game_developers,
  game_images as fixture_game_images,
  game_links as fixture_game_links,
  games as fixture_games,
} from '../tables'
import { groupByGameId } from './table-utils'

interface SeedGameGraphParams {
  prisma: PrismaClient
  adminId: number
  memberId: number
  warn: (message: string) => void
}

export interface SeedGameGraphResult {
  createdGameIds: number[]
  primaryGameId: number
  malwareGameId: number
  primaryFixtureGameTitleEn: string
}

const parsePgTextArray = (value: string[] | string | null | undefined): string[] => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const body = trimmed.slice(1, -1)
    if (!body) return []
    return body
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }
  return [trimmed]
}

export const seedGameGraph = async ({
  prisma,
  adminId,
  memberId,
  warn,
}: SeedGameGraphParams): Promise<SeedGameGraphResult> => {
  if (fixture_games.length === 0) {
    throw new Error('No fixture games found under e2e-fixtures/tables/games.ts')
  }

  const developerIdMap = new Map<number, number>()
  for (const developer of fixture_game_developers) {
    const created = await prisma.gameDeveloper.create({
      data: {
        b_id: developer.b_id,
        v_id: developer.v_id,
        name: developer.name ?? '',
        aliases: [...(developer.aliases ?? [])],
        logo: developer.logo,
        intro_jp: developer.intro_jp ?? '',
        intro_zh: developer.intro_zh ?? '',
        intro_en: developer.intro_en ?? '',
        website: developer.website,
        extra_info: (developer.extra_info ?? []) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    })
    developerIdMap.set(developer.id, created.id)
  }

  for (const developer of fixture_game_developers) {
    if (!developer.parent_developer_id) continue
    const currentId = developerIdMap.get(developer.id)
    const parentId = developerIdMap.get(developer.parent_developer_id)
    if (!currentId || !parentId) continue
    await prisma.gameDeveloper.update({
      where: {
        id: currentId,
      },
      data: {
        parent_developer_id: parentId,
      },
    })
  }

  const characterIdMap = new Map<number, number>()
  for (const character of fixture_game_characters) {
    const created = await prisma.gameCharacter.create({
      data: {
        b_id: character.b_id,
        v_id: character.v_id,
        image: character.image,
        name_jp: character.name_jp ?? '',
        name_zh: character.name_zh,
        name_en: character.name_en,
        aliases: [...(character.aliases ?? [])],
        intro_jp: character.intro_jp ?? '',
        intro_zh: character.intro_zh ?? '',
        intro_en: character.intro_en ?? '',
        blood_type: character.blood_type ? (character.blood_type as GameCharacterBloodType) : null,
        height: character.height,
        weight: character.weight,
        bust: character.bust,
        waist: character.waist,
        hips: character.hips,
        cup: character.cup,
        age: character.age,
        birthday: character.birthday ?? undefined,
        gender: parsePgTextArray(character.gender).map(item => item as GameCharacterGender),
      },
      select: {
        id: true,
      },
    })
    characterIdMap.set(character.id, created.id)
  }

  const coversByGameId = groupByGameId(fixture_game_covers)
  const imagesByGameId = groupByGameId(fixture_game_images)
  const linksByGameId = groupByGameId(fixture_game_links)
  const developerRelationsByGameId = groupByGameId(fixture_game_developer_relations)
  const characterRelationsByGameId = groupByGameId(fixture_game_character_relations)

  const gameIdMap = new Map<number, number>()
  const createdGameIds: number[] = []

  for (const [index, game] of fixture_games.entries()) {
    const coverRows = coversByGameId.get(game.id) ?? []
    const imageRows = imagesByGameId.get(game.id) ?? []
    const linkRows = linksByGameId.get(game.id) ?? []
    const developerRelationRows = developerRelationsByGameId.get(game.id) ?? []
    const characterRelationRows = characterRelationsByGameId.get(game.id) ?? []

    const developerCreates = developerRelationRows
      .map(relation => {
        const mappedDeveloperId = developerIdMap.get(relation.developer_id)
        if (!mappedDeveloperId) {
          warn(
            `Missing mapped developer id for relation ${relation.id} (developer_id=${relation.developer_id})`,
          )
          return null
        }
        return {
          role: relation.role,
          developer_id: mappedDeveloperId,
        }
      })
      .filter(Boolean) as { role: string | null; developer_id: number }[]

    const characterCreates = characterRelationRows
      .map(relation => {
        const mappedCharacterId = characterIdMap.get(relation.character_id)
        if (!mappedCharacterId) {
          warn(
            `Missing mapped character id for relation ${relation.id} (character_id=${relation.character_id})`,
          )
          return null
        }
        return {
          image: relation.image,
          actor: relation.actor,
          role: relation.role ? (relation.role as GameCharacterRole) : null,
          character_id: mappedCharacterId,
        }
      })
      .filter(Boolean) as {
      image: string | null
      actor: string | null
      role: GameCharacterRole | null
      character_id: number
    }[]

    const creatorId = index === 0 ? adminId : memberId
    const created = await prisma.game.create({
      data: {
        creator_id: creatorId,
        v_id: game.v_id,
        b_id: game.b_id,
        title_jp: game.title_jp ?? '',
        title_zh: game.title_zh ?? '',
        title_en: game.title_en ?? '',
        aliases: [...(game.aliases ?? [])],
        intro_jp: game.intro_jp ?? '',
        intro_zh: game.intro_zh ?? '',
        intro_en: game.intro_en ?? '',
        release_date: game.release_date ? new Date(game.release_date) : null,
        release_date_tba: game.release_date_tba ?? false,
        extra_info: (game.extra_info ?? []) as Prisma.InputJsonValue,
        tags: [...(game.tags ?? [])],
        staffs: (game.staffs ?? []) as Prisma.InputJsonValue,
        nsfw: Boolean(game.nsfw),
        type: game.type,
        platform: [...(game.platform ?? [])],
        status: game.status ?? 1,
        hot_score: game.hot_score ?? 0,
        views: game.views ?? 0,
        downloads: game.downloads ?? 0,
        covers: {
          create: coverRows.map(cover => ({
            language: cover.language,
            url: cover.url,
            type: cover.type,
            dims: [...(cover.dims ?? [])],
            sexual: cover.sexual,
            violence: cover.violence,
          })),
        },
        images: {
          create: imageRows.map(image => ({
            url: image.url,
            dims: [...(image.dims ?? [])],
            sexual: image.sexual,
            violence: image.violence,
          })),
        },
        link: {
          create: linkRows.map(link => ({
            url: link.url,
            label: link.label,
            name: link.name,
          })),
        },
        developers: {
          create: developerCreates,
        },
        characters: {
          create: characterCreates,
        },
      },
      select: {
        id: true,
      },
    })

    gameIdMap.set(game.id, created.id)
    createdGameIds.push(created.id)
  }

  const primaryFixtureGame = fixture_games.find(game => game.id === 1) ?? fixture_games[0]
  const primaryGameId = gameIdMap.get(primaryFixtureGame.id)
  if (!primaryGameId) {
    throw new Error(`Primary fixture game (old id=${primaryFixtureGame.id}) was not created`)
  }

  const malwareFixtureGame = fixture_games.find(game => game.id === 3) ?? fixture_games[0]
  const malwareGameId = gameIdMap.get(malwareFixtureGame.id)
  if (!malwareGameId) {
    throw new Error(`Malware fixture game (old id=${malwareFixtureGame.id}) was not created`)
  }

  return {
    createdGameIds,
    primaryGameId,
    malwareGameId,
    primaryFixtureGameTitleEn: primaryFixtureGame.title_en,
  }
}
