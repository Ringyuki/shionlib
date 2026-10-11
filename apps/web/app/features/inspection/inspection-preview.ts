import type { Schema } from '~/shared/api/types'
import type { Branches, Listed } from './inspection'

export type TextPreview = Schema<'InspectionTextDTO'>

export type TextEncoding = TextPreview['encoding']

export type Opened = { entry: Listed; path: string; images: Listed[] }

export const textEncodings = [
  'utf-8',
  'shift_jis',
  'gbk',
  'big5',
  'euc-jp',
  'utf-16le',
  'utf-16be',
] as const satisfies readonly TextEncoding[]

export const encodingNames: Record<TextEncoding, string> = {
  'utf-8': 'UTF-8',
  shift_jis: 'Shift_JIS',
  gbk: 'GBK',
  big5: 'Big5',
  'euc-jp': 'EUC-JP',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
}

export function decodeText(content: string, encoding: TextEncoding): string {
  const bytes = Uint8Array.from(atob(content), char => char.charCodeAt(0))
  return new TextDecoder(encoding).decode(bytes)
}

export function lineCount(text: string): number {
  if (text === '') {
    return 0
  }
  const lines = text.split('\n').length
  return text.endsWith('\n') ? lines - 1 : lines
}

function pathOf(known: ReadonlyMap<number, Listed>, entry: Listed): string {
  if (entry.location !== undefined) {
    return entry.location === '' ? entry.name : `${entry.location}/${entry.name}`
  }
  const names = [entry.name]
  for (
    let above = entry.parent_id === null ? undefined : known.get(entry.parent_id);
    above !== undefined;
    above = above.parent_id === null ? undefined : known.get(above.parent_id)
  ) {
    names.unshift(above.name)
  }
  return names.join('/')
}

export function openedOf(
  branches: Branches,
  known: ReadonlyMap<number, Listed>,
  entry: Listed,
): Opened {
  const beside = Object.values(branches).find(branch =>
    branch.entries.some(other => other.id === entry.id),
  )
  const images = (beside?.entries ?? [entry]).filter(other => other.preview === 'image')
  return { entry, path: pathOf(known, entry), images }
}
