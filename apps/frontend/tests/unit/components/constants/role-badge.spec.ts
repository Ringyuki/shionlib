import { describe, expect, it } from 'vitest'
import { roleBadgeColorMap } from '../../../../components/game/description/helpers/roleBadgeColorMap'

describe('components/game/description/helpers/roleBadgeColorMap (unit)', () => {
  it('maps every role to badge style classes', () => {
    expect(roleBadgeColorMap.main).toContain('bg-warning')
    expect(roleBadgeColorMap.primary).toContain('bg-primary')
    expect(roleBadgeColorMap.side).toContain('bg-accent')
    expect(roleBadgeColorMap.appears).toContain('bg-secondary')
  })
})
