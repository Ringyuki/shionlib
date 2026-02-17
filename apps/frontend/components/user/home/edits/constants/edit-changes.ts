export const ROOT_PATH_KEY = '__root__'
export const STRING_DIFF_DP_MAX_CELLS = 120_000

export type ChangeTone = 'add' | 'remove' | 'neutral'
export type RelationTone = Exclude<ChangeTone, 'neutral'>
export type DiffChangeType = 'CREATE' | 'REMOVE' | 'CHANGE'
export type StringDiffTone = Exclude<ChangeTone, 'neutral'>

export const CHANGE_PANEL_TONE_CLASSNAME: Record<ChangeTone, string> = {
  add: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
  remove: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  neutral: 'bg-muted/40 border-border',
}

export const RELATION_ICON_TONE_CLASSNAME: Record<RelationTone, string> = {
  add: 'text-green-600 dark:text-green-400',
  remove: 'text-red-600 dark:text-red-400',
}

export const RELATION_TEXT_TONE_CLASSNAME: Record<RelationTone, string> = {
  add: 'text-green-600 dark:text-green-400',
  remove: 'text-red-600 dark:text-red-400',
}

export const DIFF_BADGE_CLASSNAME: Record<DiffChangeType, string> = {
  CREATE: 'text-green-700 dark:text-green-300',
  REMOVE: 'text-red-700 dark:text-red-300',
  CHANGE: 'text-yellow-700 dark:text-yellow-300',
}

export const STRING_DIFF_SEGMENT_CLASSNAME: Record<StringDiffTone, string> = {
  add: 'bg-green-200/70 dark:bg-green-900/50 rounded-[2px]',
  remove: 'bg-red-200/70 dark:bg-red-900/50 rounded-[2px]',
}
