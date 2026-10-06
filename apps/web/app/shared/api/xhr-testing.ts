export type SentXhr = {
  method: string
  url: string
  headers: Record<string, string>
  body: Blob | null
}

export type FakeXhrReply =
  | { status: number; text?: string; headers?: Record<string, string>; progress?: number[] }
  | 'network-error'
  | 'hang'

export function fakeXhr(reply: (request: SentXhr) => FakeXhrReply) {
  const sent: SentXhr[] = []

  class FakeXMLHttpRequest {
    status = 0
    statusText = ''
    responseText = ''
    upload: { onprogress: ((event: { loaded: number }) => void) | null } = { onprogress: null }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    private request: SentXhr = { method: '', url: '', headers: {}, body: null }
    private rawHeaders = ''
    private settled = false

    open(method: string, url: string) {
      this.request = { method, url, headers: {}, body: null }
    }

    setRequestHeader(name: string, value: string) {
      this.request.headers[name.toLowerCase()] = value
    }

    getAllResponseHeaders() {
      return this.rawHeaders
    }

    send(body: Blob | null) {
      this.request.body = body
      sent.push(this.request)
      const answer = reply(this.request)
      queueMicrotask(() => this.answer(answer))
    }

    abort() {
      if (!this.settled) {
        this.settled = true
        this.onabort?.()
      }
    }

    private answer(answer: FakeXhrReply) {
      if (this.settled || answer === 'hang') {
        return
      }
      this.settled = true
      if (answer === 'network-error') {
        this.onerror?.()
        return
      }
      for (const loaded of answer.progress ?? []) {
        this.upload.onprogress?.({ loaded })
      }
      this.status = answer.status
      this.responseText = answer.text ?? ''
      this.rawHeaders = Object.entries(answer.headers ?? {})
        .map(([name, value]) => `${name}: ${value}`)
        .join('\r\n')
      this.onload?.()
    }
  }

  return { XMLHttpRequest: FakeXMLHttpRequest, sent }
}
