import { describe, expect, it } from 'vitest'
import {
  CHANGE_PANEL_TONE_CLASSNAME,
  DIFF_BADGE_CLASSNAME,
  ROOT_PATH_KEY,
  STRING_DIFF_DP_MAX_CELLS,
} from '../../../../components/user/home/edits/constants/edit-changes'

describe('components/user/home/edits/constants/edit-changes (unit)', () => {
  it('defines root key and dp guardrail', () => {
    expect(ROOT_PATH_KEY).toBe('__root__')
    expect(STRING_DIFF_DP_MAX_CELLS).toBeGreaterThan(1000)
  })

  it('exposes style maps for tone and diff badges', () => {
    expect(CHANGE_PANEL_TONE_CLASSNAME.add).toContain('green')
    expect(CHANGE_PANEL_TONE_CLASSNAME.remove).toContain('red')
    expect(DIFF_BADGE_CLASSNAME.CREATE).toContain('green')
    expect(DIFF_BADGE_CLASSNAME.REMOVE).toContain('red')
    expect(DIFF_BADGE_CLASSNAME.CHANGE).toContain('yellow')
  })
})
