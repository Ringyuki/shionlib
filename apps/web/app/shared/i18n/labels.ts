export function labelOf(table: Readonly<Record<string, string>>, key: string): string {
  return Object.hasOwn(table, key) ? (table[key] ?? key) : key
}
