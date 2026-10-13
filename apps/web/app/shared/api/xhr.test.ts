import { afterEach, describe, expect, it, vi } from 'vitest'
import { toResponse, xhrSend } from './xhr'
import { fakeXhr, type FakeXhrReply } from './xhr-testing'

function install(reply: FakeXhrReply) {
  const fake = fakeXhr(() => reply)
  vi.stubGlobal('XMLHttpRequest', fake.XMLHttpRequest)
  return fake
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('xhrSend', () => {
  it('sends the request and reads the status, headers and body', async () => {
    const fake = install({ status: 200, text: '{"ok":true}', headers: { 'Retry-After': '3' } })
    const body = new Blob(['chunk'])
    const response = await xhrSend({
      method: 'PUT',
      url: '/api/x',
      headers: new Headers({ 'chunk-sha256': 'abc' }),
      body,
    })
    expect(response).toMatchObject({ status: 200, text: '{"ok":true}' })
    expect(response.headers.get('retry-after')).toBe('3')
    expect(fake.sent[0]).toEqual({
      method: 'PUT',
      url: '/api/x',
      headers: { 'chunk-sha256': 'abc' },
      body,
    })
  })

  it('reports how many bytes went out', async () => {
    install({ status: 200, progress: [10, 25] })
    const progress: number[] = []
    await xhrSend({ method: 'PUT', url: '/api/x', onUploadProgress: sent => progress.push(sent) })
    expect(progress).toEqual([10, 25])
  })

  it('fails like fetch when the network fails', async () => {
    install('network-error')
    await expect(xhrSend({ method: 'GET', url: '/api/x' })).rejects.toBeInstanceOf(TypeError)
  })

  it('stops with the reason of the abort signal', async () => {
    const fake = install('hang')
    const controller = new AbortController()
    const sending = xhrSend({ method: 'GET', url: '/api/x', signal: controller.signal })
    controller.abort('paused')
    await expect(sending).rejects.toBe('paused')
    await expect(xhrSend({ method: 'GET', url: '/api/y', signal: controller.signal })).rejects.toBe(
      'paused',
    )
    expect(fake.sent).toHaveLength(1)
  })
})

describe('toResponse', () => {
  it('keeps empty replies bodiless', async () => {
    const response = toResponse({ status: 204, statusText: '', headers: new Headers(), text: '' })
    expect(response.status).toBe(204)
    await expect(response.text()).resolves.toBe('')
  })
})
