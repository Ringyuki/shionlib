import { Injectable } from '@nestjs/common'
import { HikarinagiClient } from '../clients/hikarinagi.client'
import { emptyNestedGame, mapCardToNestedGame } from '../mappers/galgame-read.mapper'

@Injectable()
export class HikarinagiCardService {
  constructor(private readonly internal: HikarinagiClient) {}

  async hydrate<T extends { game: { id: number; h_id: number | null } | null }>(
    rows: T[],
    includeRated: boolean,
  ): Promise<T[]> {
    const ids = [
      ...new Set(rows.map(row => row.game?.h_id).filter((id): id is number => id != null)),
    ]
    if (!ids.length) return rows

    const cards = await this.internal.galgameBatch(ids)
    const byId = new Map(cards.map(card => [card.id, card]))

    return rows.map(row => {
      if (!row.game) return row
      const card = row.game.h_id != null ? byId.get(row.game.h_id) : undefined

      return {
        ...row,
        game: {
          id: row.game.id,
          ...emptyNestedGame(),
          ...(card ? mapCardToNestedGame(card, includeRated) : {}),
        },
      } as T
    })
  }
}
