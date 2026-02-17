export const makeETag = async (input: string) => {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-1', data)
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `"W/${hex}"`
}
