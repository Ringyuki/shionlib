export interface ResponseInterface<T> {
  code: number
  message: string
  data: T | null
  requestId: string
  timestamp: string
  meta?: Record<string, unknown>
}

type MetaBase = {
  totalItems: number
  itemCount: number
  itemsPerPage: number
  totalPages: number
  currentPage: number
}

type MetaExtras<E> = {
  [K in Exclude<string, keyof MetaBase>]?: E
}

export interface PaginatedResult<T, E = string | number | boolean | undefined> {
  items: T[]
  meta: MetaBase & MetaExtras<E>
}

export interface FieldError {
  field: string
  messages: string[]
}
