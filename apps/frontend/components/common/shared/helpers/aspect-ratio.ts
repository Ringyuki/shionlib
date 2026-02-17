export const normalizeAspectRatio = (value?: string) => {
  if (!value) return undefined
  const compact = value.replace(/\s+/g, '')
  if (!compact) return undefined
  if (compact.includes('/')) {
    const [rawWidth, rawHeight] = compact.split('/')
    const width = Number(rawWidth)
    const height = Number(rawHeight)
    if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
      return undefined
    }
    return `${width} / ${height}`
  }
  const numeric = Number(compact)
  if (!isFinite(numeric) || numeric <= 0) {
    return undefined
  }
  return `${numeric} / 1`
}
