import { describe, expect, it } from 'vitest'
import { LanguageMap } from '../../../../components/game/patch/constants/language'
import { PlatformMap } from '../../../../components/game/patch/constants/platform'
import {
  SUPPORTED_TYPE_MAP,
  TypeMap,
  TypeTokenMap,
} from '../../../../components/game/patch/constants/type'

describe('components/game/patch/constants (unit)', () => {
  it('maps external language/platform keys to internal values', () => {
    expect(LanguageMap['zh-Hans']).toBe('zh')
    expect(LanguageMap.ja).toBe('jp')
    expect(LanguageMap.other).toBe('other')
    expect(PlatformMap.windows).toBe('win')
    expect(PlatformMap.android).toBe('and')
  })

  it('defines patch type maps and token styles', () => {
    expect(TypeMap.machine_polishing).toBe('machine_polishing')
    expect(TypeMap.mod).toBe('mod')
    expect(TypeTokenMap.manual.bg).toContain('--type-manual-bg')
    expect(SUPPORTED_TYPE_MAP.fix).toContain('修正')
  })

  it('covers every patch type moyu can return', () => {
    for (const type of ['r18', 'decensor', 'image'] as const) {
      expect(TypeMap[type]).toBe(type)
      expect(TypeTokenMap[type].text).toBe(`var(--type-${type})`)
      expect(TypeTokenMap[type].bg).toBe(`var(--type-${type}-bg)`)
    }
  })
})
