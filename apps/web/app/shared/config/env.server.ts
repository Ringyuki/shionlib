import type { PublicConfig } from './public-config'

export type ServerEnv = {
  apiInternalUrl: string
  publicConfig: PublicConfig
}

const trimSlash = (value: string) => value.replace(/\/+$/, '')

function capEndpointFrom(value: string | undefined): string {
  const endpoint = trimSlash(value ?? '')
  return endpoint === '' ? '' : `${endpoint}/`
}

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return {
    apiInternalUrl: trimSlash(source.API_INTERNAL_URL ?? 'http://localhost:5000'),
    publicConfig: {
      imageBaseUrl: trimSlash(source.IMAGE_BASE_URL ?? 'https://t.shionlib.com'),
      hikarinagiSiteUrl: trimSlash(source.HIKARINAGI_SITE_URL ?? 'https://www.hikarinagi.org'),
      capEndpoint: capEndpointFrom(source.CAP_ENDPOINT),
    },
  }
}
