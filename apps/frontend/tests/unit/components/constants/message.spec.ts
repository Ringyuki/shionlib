import { describe, expect, it } from 'vitest'
import { MessageTone, MessageType } from '../../../../interfaces/message/message.interface'
import { sidebarItems } from '../../../../components/message/constants/sidebar'
import { toneConfig, typeConfig } from '../../../../components/message/constants/message-item'

describe('components/message/constants (unit)', () => {
  it('contains sidebar navigation entries', () => {
    expect(sidebarItems).toHaveLength(4)
    expect(sidebarItems.map(item => item.link)).toEqual(
      expect.arrayContaining([
        '/message',
        '/message/system',
        '/message/comment-reply',
        '/message/comment-like',
      ]),
    )
  })

  it('defines type and tone configuration for all message enums', () => {
    for (const type of Object.values(MessageType)) {
      expect(typeConfig[type]).toBeDefined()
      expect(typeConfig[type]?.icon).toBeTruthy()
    }
    for (const tone of Object.values(MessageTone)) {
      expect(toneConfig[tone]).toBeDefined()
      expect(toneConfig[tone]?.color.length).toBeGreaterThan(0)
      expect(toneConfig[tone]?.iconBg.length).toBeGreaterThan(0)
    }
  })
})
