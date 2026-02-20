export const groupByGameId = <T extends { game_id: number }>(rows: T[]): Map<number, T[]> => {
  const grouped = new Map<number, T[]>()
  for (const row of rows) {
    if (!grouped.has(row.game_id)) grouped.set(row.game_id, [])
    grouped.get(row.game_id)?.push(row)
  }
  return grouped
}
