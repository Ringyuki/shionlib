import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { GameCharacter, GameCharacterGender, GameDeveloper } from '../interfaces/game.interface'

@Injectable()
export class GameEntityUpsertService {
  async findOrCreateDeveloper(tx: Prisma.TransactionClient, d: GameDeveloper) {
    const existing = await tx.gameDeveloper.findFirst({
      where: {
        OR: [
          d.v_id ? { v_id: d.v_id } : undefined,
          d.b_id ? { b_id: d.b_id } : undefined,
          d.name ? { name: d.name } : undefined,
        ].filter(Boolean) as any,
      },
    })
    if (existing) return existing

    return tx.gameDeveloper.create({
      data: {
        v_id: d.v_id,
        b_id: d.b_id,
        name: d.name?.trim() || '',
        aliases: this.dataOrEmpty(d.aliases, []),
        logo: d.logo,
        intro_jp: this.dataOrEmpty(d.intro_jp, ''),
        intro_zh: this.dataOrEmpty(d.intro_zh, ''),
        intro_en: this.dataOrEmpty(d.intro_en, ''),
        website: d.website,
        extra_info: this.dataOrEmpty(d.extra_info, []),
      } as any,
    })
  }

  async findOrCreateCharacter(tx: Prisma.TransactionClient, c: GameCharacter) {
    const existing = await tx.gameCharacter.findFirst({
      where: {
        OR: [c.v_id ? { v_id: c.v_id } : undefined, c.b_id ? { b_id: c.b_id } : undefined].filter(
          Boolean,
        ) as any,
      },
    })
    if (existing) return existing

    return tx.gameCharacter.create({
      data: {
        v_id: c.v_id,
        b_id: c.b_id,
        image: c.image,
        name_jp: this.dataOrEmpty(c.name_jp, ''),
        name_zh: c.name_zh,
        name_en: c.name_en,
        aliases: this.dataOrEmpty(c.aliases, []),
        intro_jp: this.dataOrEmpty(c.intro_jp, ''),
        intro_zh: this.dataOrEmpty(c.intro_zh, ''),
        intro_en: this.dataOrEmpty(c.intro_en, ''),
        blood_type: c.blood_type,
        height: c.height,
        weight: c.weight,
        bust: c.bust,
        waist: c.waist,
        hips: c.hips,
        cup: c.cup,
        age: c.age,
        birthday: this.dataOrEmpty(c.birthday, []).filter(
          (v): v is number => v !== null && v !== undefined,
        ),
        gender: this.dataOrEmpty(c.gender, []).filter(
          (v): v is GameCharacterGender => v !== null && v !== undefined,
        ),
      },
    })
  }

  private dataOrEmpty = <T>(value: T | undefined | null, fallback: T) =>
    value === undefined || value === null ? fallback : value
}
