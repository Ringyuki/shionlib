import { fetchResources } from '@takumi-rs/helpers'
import { config } from '@/config'

export type Picture = { src: string; data: ArrayBuffer }

const PICTURE_TIMEOUT_MS = 5000

export function pictureUrl(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  if (/^https?:\/\//.test(value)) {
    return value
  }
  const base = config.SHIONLIB_IMAGE_BED_URL.replace(/\/+$/, '')
  return `${base}/${value.replace(/^\/+/, '')}`
}

export async function loadPictures(urls: (string | undefined)[]): Promise<Picture[]> {
  const wanted = [...new Set(urls.filter((url): url is string => url !== undefined))]
  if (wanted.length === 0) {
    return []
  }
  return fetchResources(wanted, { timeout: PICTURE_TIMEOUT_MS, throwOnError: false })
}
