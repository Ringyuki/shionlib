export const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(normalized + padding)

  return Uint8Array.from(binary, ch => ch.charCodeAt(0))
}
