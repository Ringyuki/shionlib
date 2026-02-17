export const withDefault = <T>(
  envName: string,
  defaultValue: T,
  parser?: (raw: string) => T,
): T => {
  const raw = process.env[envName]
  if (raw === undefined || raw === null || raw === '') return defaultValue

  try {
    if (parser) {
      return parser(raw)
    }

    switch (typeof defaultValue) {
      case 'number': {
        const parsedNumber = Number(raw)
        return Number.isFinite(parsedNumber) ? (parsedNumber as unknown as T) : defaultValue
      }
      case 'boolean': {
        const normalized = raw.trim().toLowerCase()
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true as unknown as T
        if (['false', '0', 'no', 'off'].includes(normalized)) return false as unknown as T
        return defaultValue
      }
      case 'string':
        return raw as unknown as T
      default:
        try {
          return JSON.parse(raw) as T
        } catch {
          return defaultValue
        }
    }
  } catch {
    return defaultValue
  }
}
