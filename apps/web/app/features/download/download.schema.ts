import * as v from 'valibot'
import { defaultDownloadSettings, downloadMethods, type DownloadSettings } from './download'

export const issueLinkCommand = v.object({
  fileId: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  token: v.pipe(v.string(), v.minLength(1)),
})

export type IssueLink = v.InferOutput<typeof issueLinkCommand>

const fallbackAria2 = defaultDownloadSettings.aria2

const storedSettings = v.fallback(
  v.pipe(
    v.string(),
    v.parseJson(),
    v.object({
      method: v.fallback(v.picklist(downloadMethods), defaultDownloadSettings.method),
      aria2: v.fallback(
        v.object({
          endpoint: v.fallback(v.pipe(v.string(), v.url()), fallbackAria2.endpoint),
          secret: v.fallback(v.string(), fallbackAria2.secret),
          directory: v.fallback(v.string(), fallbackAria2.directory),
        }),
        fallbackAria2,
      ),
    }),
  ),
  defaultDownloadSettings,
)

export function downloadSettingsFrom(stored: string | null): DownloadSettings {
  return v.parse(storedSettings, stored)
}
