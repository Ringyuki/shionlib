export function imageUrl(base: string, key: string | null | undefined): string | undefined {
  if (key === null || key === undefined || key === '') {
    return undefined
  }
  if (/^(https?:|data:|blob:)/.test(key)) {
    return key
  }
  return `${base}/${key.replace(/^\/+/, '')}`
}
