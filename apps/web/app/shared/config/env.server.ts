export type ServerEnv = {
  apiInternalUrl: string
}

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return {
    apiInternalUrl: (source.API_INTERNAL_URL ?? 'http://localhost:5000').replace(/\/+$/, ''),
  }
}
