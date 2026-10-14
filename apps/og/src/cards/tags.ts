import type { Labels } from '@/i18n/messages'
import { textWidth } from './measure'

export type TagItem =
  | { kind: 'platform'; platform: string; label: string }
  | { kind: 'soft'; label: string }

const platformOrder = ['win', 'mac', 'ios', 'and', 'lin', 'ps3', 'ps4', 'psv', 'psp', 'swi', 'dvd']
const languageOrder = ['zh', 'zh-hant', 'jp', 'en']

const TAG_FONT = 28
const TAG_PADDING = 40
const TAG_ICON = 40
const TAG_GAP = 12
const NOTE_GAP = 12

function ordered(values: string[], order: string[]): string[] {
  const unique = [...new Set(values)]
  const rank = (value: string) => {
    const index = order.indexOf(value)
    return index === -1 ? order.length : index
  }
  return unique.sort((a, b) => rank(a) - rank(b))
}

export function platformTags(platforms: string[], labels: Labels): TagItem[] {
  return ordered(platforms, platformOrder).map(platform => ({
    kind: 'platform',
    platform,
    label: labels.platform[platform] ?? platform,
  }))
}

export function languageTags(languages: string[], labels: Labels): TagItem[] {
  return ordered(languages, languageOrder).map(language => ({
    kind: 'soft',
    label: labels.language[language] ?? language,
  }))
}

export function softTags(values: (string | undefined)[]): TagItem[] {
  return values
    .filter((value): value is string => value !== undefined && value !== '')
    .map(label => ({ kind: 'soft', label }))
}

export function tagWidth(tag: TagItem): number {
  const icon = tag.kind === 'platform' && platformOrder.includes(tag.platform) ? TAG_ICON : 0
  return TAG_PADDING + icon + textWidth(tag.label, TAG_FONT)
}

export function fitRow(tags: TagItem[], note: string | undefined, width: number): TagItem[] {
  const noteWidth = note ? TAG_GAP + NOTE_GAP + textWidth(note, TAG_FONT) : 0
  const fitted: TagItem[] = []
  let used = 0
  for (const tag of tags) {
    const next = used + (fitted.length > 0 ? TAG_GAP : 0) + tagWidth(tag)
    if (next + noteWidth > width) {
      break
    }
    fitted.push(tag)
    used = next
  }
  return fitted
}
