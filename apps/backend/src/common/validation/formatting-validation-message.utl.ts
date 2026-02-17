import { I18nService } from 'nestjs-i18n'

export const formattingValidationMessage = (raw: unknown, i18n: I18nService, lang?: string) => {
  if (typeof raw !== 'string') return String(raw ?? '')
  const sep = raw.indexOf('|')
  if (sep === -1) return raw
  const key = raw.slice(0, sep)
  const json = raw.slice(sep + 1)
  let args: any = {}
  try {
    args = JSON.parse(json)
  } catch {
    // ignore
  }
  return i18n.t(key as any, { lang, args }) as string
}
