export type XhrRequest = {
  method: string
  url: string
  headers?: Headers
  body?: Blob | null
  signal?: AbortSignal
  onUploadProgress?: (sent: number) => void
}

export type XhrResponse = {
  status: number
  statusText: string
  headers: Headers
  text: string
}

export function xhrSend(request: XhrRequest): Promise<XhrResponse> {
  return new Promise((resolve, reject) => {
    const { signal, onUploadProgress } = request
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const settle = () => signal?.removeEventListener('abort', abort)
    xhr.open(request.method, request.url)
    request.headers?.forEach((value, name) => xhr.setRequestHeader(name, value))
    if (onUploadProgress !== undefined) {
      xhr.upload.onprogress = event => onUploadProgress(event.loaded)
    }
    xhr.onload = () => {
      settle()
      resolve({
        status: xhr.status,
        statusText: xhr.statusText,
        headers: responseHeaders(xhr.getAllResponseHeaders()),
        text: xhr.responseText,
      })
    }
    xhr.onerror = () => {
      settle()
      reject(new TypeError('Network request failed'))
    }
    xhr.onabort = () => {
      settle()
      reject(signal?.reason ?? new DOMException('The request was aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    xhr.send(request.body ?? null)
  })
}

export function toResponse(response: XhrResponse): Response {
  const empty = response.text === '' || response.status === 204 || response.status === 304
  return new Response(empty ? null : response.text, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

function responseHeaders(raw: string): Headers {
  const headers = new Headers()
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator > 0) {
      headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
    }
  }
  return headers
}
