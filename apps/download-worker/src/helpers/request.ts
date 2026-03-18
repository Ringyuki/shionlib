const FORWARDABLE_HEADERS = ['range', 'if-range', 'accept', 'accept-encoding', 'user-agent']

export const buildOriginHeaders = (request: Request) => {
  const headers = new Headers()

  for (const name of FORWARDABLE_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  return headers
}
