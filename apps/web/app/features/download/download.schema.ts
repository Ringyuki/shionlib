import * as v from 'valibot'
import {
  defaultDownloadSettings,
  downloadMethods,
  type DownloadMethod,
  type DownloadSettings,
} from './download'

export const issueLinkCommand = v.object({
  fileId: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  token: v.pipe(v.string(), v.minLength(1)),
})

export type IssueLink = v.InferOutput<typeof issueLinkCommand>

const fallbackAria2 = defaultDownloadSettings.aria2

const shownManagers = defaultDownloadSettings.managers

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
      managers: v.fallback(
        v.object({
          lunabox: v.fallback(v.boolean(), shownManagers.lunabox),
          reina: v.fallback(v.boolean(), shownManagers.reina),
          potatovn: v.fallback(v.boolean(), shownManagers.potatovn),
        }),
        shownManagers,
      ),
    }),
  ),
  defaultDownloadSettings,
)

export function downloadSettingsFrom(stored: string | null): DownloadSettings {
  return v.parse(storedSettings, stored)
}

const method = v.picklist(downloadMethods)

export function downloadMethodFrom(value: unknown): DownloadMethod | undefined {
  const parsed = v.safeParse(method, value)
  return parsed.success ? parsed.output : undefined
}

export type Aria2Issue = 'endpoint'

export function aria2Form(issue: (key: Aria2Issue) => string) {
  return v.object({
    endpoint: v.pipe(
      v.string(),
      v.trim(),
      v.url(issue('endpoint')),
      v.regex(/^https?:\/\//i, issue('endpoint')),
    ),
    secret: v.string(),
    directory: v.string(),
  })
}

export type Aria2Values = v.InferInput<ReturnType<typeof aria2Form>>

const aria2Target = aria2Form(() => '')

export function aria2TargetFrom(values: Aria2Values): Aria2Values | undefined {
  const parsed = v.safeParse(aria2Target, values)
  return parsed.success ? parsed.output : undefined
}
