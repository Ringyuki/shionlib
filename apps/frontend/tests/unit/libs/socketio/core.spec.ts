// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const socket = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }

  return {
    ioMock: vi.fn(() => socket),
    socket,
  }
})

vi.mock('socket.io-client', () => ({
  io: hoisted.ioMock,
}))

describe('libs/socketio/core (unit)', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.ioMock.mockClear()
    hoisted.socket.connect.mockClear()
    hoisted.socket.disconnect.mockClear()
    hoisted.socket.on.mockClear()
    hoisted.socket.off.mockClear()
  })

  it('creates singleton socket instance and manages provider connect/disconnect', async () => {
    const pageModule = await import('../../../../libs/socketio/core')

    const Consumer = () => {
      const socket = pageModule.useSocket()
      return React.createElement('span', { 'data-testid': 'socket-state' }, socket ? 'yes' : 'no')
    }

    const { unmount } = render(
      React.createElement(pageModule.SocketProvider, null, React.createElement(Consumer)),
    )

    await waitFor(() => {
      expect(screen.getByTestId('socket-state').textContent).toBe('yes')
    })

    expect(hoisted.ioMock).toHaveBeenCalledTimes(1)
    expect(hoisted.ioMock).toHaveBeenCalledWith(
      '/ws',
      expect.objectContaining({
        withCredentials: true,
        autoConnect: false,
        transports: ['websocket'],
      }),
    )
    expect(hoisted.socket.connect).toHaveBeenCalledTimes(1)

    unmount()
    expect(hoisted.socket.disconnect).toHaveBeenCalledTimes(1)
  })

  it('reuses socket instance across provider remounts', async () => {
    const pageModule = await import('../../../../libs/socketio/core')

    const first = render(
      React.createElement(pageModule.SocketProvider, null, React.createElement('div')),
    )
    first.unmount()

    const second = render(
      React.createElement(pageModule.SocketProvider, null, React.createElement('div')),
    )
    second.unmount()

    expect(hoisted.ioMock).toHaveBeenCalledTimes(1)
    expect(hoisted.socket.connect).toHaveBeenCalledTimes(2)
    expect(hoisted.socket.disconnect).toHaveBeenCalledTimes(2)
  })

  it('registers and unregisters socket event handlers', async () => {
    const pageModule = await import('../../../../libs/socketio/core')

    const callbackA = vi.fn()
    const callbackB = vi.fn()

    const Harness = ({ callback }: { callback: (data: unknown) => void }) => {
      pageModule.useSocketEvent(hoisted.socket as any, 'message:new', callback as any)
      return null
    }

    const { rerender, unmount } = render(React.createElement(Harness, { callback: callbackA }))
    expect(hoisted.socket.on).toHaveBeenCalledWith('message:new', callbackA)

    rerender(React.createElement(Harness, { callback: callbackB }))
    expect(hoisted.socket.off).toHaveBeenCalledWith('message:new', callbackA)
    expect(hoisted.socket.on).toHaveBeenCalledWith('message:new', callbackB)

    unmount()
    expect(hoisted.socket.off).toHaveBeenCalledWith('message:new', callbackB)
  })

  it('does nothing when socket is null', async () => {
    const pageModule = await import('../../../../libs/socketio/core')

    const callback = vi.fn()

    const Harness = () => {
      pageModule.useSocketEvent(null, 'message:new', callback as any)
      return null
    }

    const { unmount } = render(React.createElement(Harness))
    unmount()

    expect(hoisted.socket.on).not.toHaveBeenCalled()
    expect(hoisted.socket.off).not.toHaveBeenCalled()
  })
})
