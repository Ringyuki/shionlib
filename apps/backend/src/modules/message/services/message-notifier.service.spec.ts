import { MessageGateway } from '../gateways/message.gateway'
import { MessageNotifier } from './message-notifier.service'

describe('MessageNotifier', () => {
  it('emits new message event to user room', () => {
    const emit = jest.fn()
    const to = jest.fn().mockReturnValue({ emit })
    const gateway = {
      server: { to },
    } as unknown as MessageGateway
    const service = new MessageNotifier(gateway)

    service.notifyNewMessage(12, {
      id: 99,
      title: 'new',
      type: 'system',
      tone: 'info',
      created: new Date('2026-01-01T00:00:00.000Z'),
    } as any)

    expect(to).toHaveBeenCalledWith('user:12')
    expect(emit).toHaveBeenCalledWith(
      'message:new',
      expect.objectContaining({
        id: 99,
        title: 'new',
      }),
    )
  })

  it('emits unread count event to user room', () => {
    const emit = jest.fn()
    const to = jest.fn().mockReturnValue({ emit })
    const gateway = {
      server: { to },
    } as unknown as MessageGateway
    const service = new MessageNotifier(gateway)

    service.notifyUnreadCount(77, 5)

    expect(to).toHaveBeenCalledWith('user:77')
    expect(emit).toHaveBeenCalledWith('message:unread', { unread: 5 })
  })
})
