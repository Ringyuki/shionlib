import { aria2ReplyFrom } from './aria2.schema'

export type Aria2Target = {
  endpoint: string
  secret: string
  directory: string
}

export type Aria2Download = {
  url: string
  fileName: string
}

export type Aria2Outcome =
  | { ok: true; gid: string }
  | { ok: false; reason: 'unreachable' | 'unauthorized' | 'rejected'; message: string }

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
  const body = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'aria2.addUri',
    params: [`token:${target.secret}`, [download.url], options],
  }
  let response: Response
  try {
    response = await fetch(target.endpoint, { method: 'POST', body: JSON.stringify(body) })
  } catch {
    return { ok: false, reason: 'unreachable', message: '' }
  }
  const reply = aria2ReplyFrom(await response.json().catch(() => undefined))
  if (reply === undefined) {
    return { ok: false, reason: 'unreachable', message: '' }
  }
  if ('result' in reply) {
    return { ok: true, gid: reply.result }
  }
  return {
    ok: false,
    reason: reply.error.message === 'Unauthorized' ? 'unauthorized' : 'rejected',
    message: reply.error.message,
  }
}
