import { aria2ReplyFrom, aria2VersionReplyFrom } from './aria2.schema'

export type Aria2Target = {
  endpoint: string
  secret: string
  directory: string
}

export type Aria2Download = {
  url: string
  fileName: string
}

type Aria2Refusal = {
  ok: false
  reason: 'unreachable' | 'unauthorized' | 'rejected'
  message: string
}

export type Aria2Outcome = { ok: true; gid: string } | Aria2Refusal

export type Aria2Reach = { ok: true; version: string } | Aria2Refusal

const unreachable: Aria2Refusal = { ok: false, reason: 'unreachable', message: '' }

function refusalOf(message: string): Aria2Refusal {
  return { ok: false, reason: message === 'Unauthorized' ? 'unauthorized' : 'rejected', message }
}

async function call(endpoint: string, method: string, params: unknown[]): Promise<unknown> {
  const body = { jsonrpc: '2.0', id: crypto.randomUUID(), method, params }
  try {
    const response = await fetch(endpoint, { method: 'POST', body: JSON.stringify(body) })
    return await response.json()
  } catch {
    return undefined
  }
}

export async function reachAria2(
  target: Pick<Aria2Target, 'endpoint' | 'secret'>,
): Promise<Aria2Reach> {
  const reply = aria2VersionReplyFrom(
    await call(target.endpoint, 'aria2.getVersion', [`token:${target.secret}`]),
  )
  if (reply === undefined) {
    return unreachable
  }
  return 'result' in reply
    ? { ok: true, version: reply.result.version }
    : refusalOf(reply.error.message)
}

const unsafeFileName = /[<>:"/\\|?*]/g

export function aria2FileName(name: string): string {
  const safe = name.trim().replace(unsafeFileName, '_')
  return safe === '' ? 'download' : safe
}

export async function pushToAria2(
  target: Aria2Target,
  download: Aria2Download,
): Promise<Aria2Outcome> {
  const options = {
    out: aria2FileName(download.fileName),
    ...(target.directory.trim() === '' ? {} : { dir: target.directory.trim() }),
  }
  const reply = aria2ReplyFrom(
    await call(target.endpoint, 'aria2.addUri', [
      `token:${target.secret}`,
      [download.url],
      options,
    ]),
  )
  if (reply === undefined) {
    return unreachable
  }
  return 'result' in reply ? { ok: true, gid: reply.result } : refusalOf(reply.error.message)
}
