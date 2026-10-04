import { data } from 'react-router'

export function idParam(value: string | undefined): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw data(null, { status: 404 })
  }
  return id
}
