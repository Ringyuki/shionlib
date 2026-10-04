export type ServerEnv = {
  apiInternalUrl: string
  imageBaseUrl: string
  version: string
}

const trimSlash = (value: string) => value.replace(/\/+$/, '')

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return {
    apiInternalUrl: trimSlash(source.API_INTERNAL_URL ?? 'http://localhost:5000'),
    imageBaseUrl: trimSlash(source.IMAGE_BASE_URL ?? 'https://t.shionlib.com'),
    version: source.APP_VERSION ?? 'dev',
  }
}
