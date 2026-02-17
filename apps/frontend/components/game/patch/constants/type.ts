import { PatchType } from '@/interfaces/patch/patch.interface'

export const TypeMap: Record<string, Partial<PatchType>> = {
  manual: 'manual',
  ai: 'ai',
  machine_polishing: 'machine_polishing',
  machine: 'machine',
  save: 'save',
  crack: 'crack',
  fix: 'fix',
  mod: 'mod',
  other: 'other',
}

export const TypeTokenMap: Record<PatchType, { text: string; bg: string }> = {
  manual: { text: 'var(--type-manual)', bg: 'var(--type-manual-bg)' },
  ai: { text: 'var(--type-ai)', bg: 'var(--type-ai-bg)' },
  machine_polishing: {
    text: 'var(--type-machine_polishing)',
    bg: 'var(--type-machine_polishing-bg)',
  },
  machine: { text: 'var(--type-machine)', bg: 'var(--type-machine-bg)' },
  save: { text: 'var(--type-save)', bg: 'var(--type-save-bg)' },
  crack: { text: 'var(--type-crack)', bg: 'var(--type-crack-bg)' },
  fix: { text: 'var(--type-fix)', bg: 'var(--type-fix-bg)' },
  mod: { text: 'var(--type-mod)', bg: 'var(--type-mod-bg)' },
  other: { text: 'var(--type-other)', bg: 'var(--type-other-bg)' },
}

export const SUPPORTED_TYPE_MAP: Record<string, string> = {
  manual: '人工翻译补丁',
  ai: 'AI 翻译补丁',
  machine_polishing: '机翻润色',
  machine: '机翻补丁',
  save: '全 CG 存档',
  crack: '破解补丁',
  fix: '修正补丁',
  mod: '魔改补丁',
  other: '其它',
}
