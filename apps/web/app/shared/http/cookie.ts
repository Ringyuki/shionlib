export function readCookie(header: string, name: string): string | undefined {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim()
    }
  }
  return undefined
}
