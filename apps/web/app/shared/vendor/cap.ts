import wasmUrl from '@cap.js/wasm/browser/cap_wasm_bg.wasm?url'
import hashwxUrl from '@cap.js/wasm/browser/hashwx.wasm?url'
import inflateUrl from 'pako/dist/pako_inflate.min.js?url'
import { capProblemFrom, type CapProblem } from './cap.schema'

export type CapFailure = 'unavailable' | 'blocked' | 'failed'

export type CapRefusal = CapProblem & { ok: false; failure: CapFailure }

export type CapOutcome =
  { ok: true; token: string } | CapRefusal | { ok: false; failure: 'stopped' }

type SolveOptions = {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

const unreachable = new Set([
  'missing_endpoint',
  'network_error',
  'challenge_parse_error',
  'redeem_failed',
  'wasm_load_failed',
  'worker_spawn_failed',
  'load_failed',
  'solve_failed',
])

const blockedByServer = 'Blocked by instrumentation'

export function capFailureOf({ code, message }: CapProblem): CapFailure {
  if (code === 'instr_blocked' || message === blockedByServer) {
    return 'blocked'
  }
  return unreachable.has(code) ? 'unavailable' : 'failed'
}

function refusal(problem: CapProblem): CapRefusal {
  return { ok: false, failure: capFailureOf(problem), ...problem }
}

async function loadCap() {
  window.CAP_CUSTOM_WASM_URL = wasmUrl
  window.CAP_CUSTOM_HASHWX_URL = hashwxUrl
  window.CAP_PAKO_URL = inflateUrl
  window.CAP_SILENT = true
  const widget = await import('cap-widget')
  return widget.default
}

export async function solveCap(endpoint: string, options: SolveOptions = {}): Promise<CapOutcome> {
  const { onProgress, signal } = options
  const stopped = () => signal?.aborted === true
  if (endpoint === '') {
    return refusal({ code: 'missing_endpoint', message: 'CAP_ENDPOINT is not set' })
  }
  let Cap: Awaited<ReturnType<typeof loadCap>>
  try {
    Cap = await loadCap()
  } catch (error) {
    return refusal({ code: 'load_failed', message: capProblemFrom(error).message })
  }
  if (stopped()) {
    return { ok: false, failure: 'stopped' }
  }
  const cap = new Cap({ apiEndpoint: endpoint })
  const stop = () => cap.widget.remove()
  let reported: CapProblem | undefined
  cap.addEventListener('progress', event => onProgress?.(event.detail.progress))
  cap.addEventListener('error', event => {
    event.stopPropagation()
    reported = capProblemFrom(event.detail)
  })
  signal?.addEventListener('abort', stop, { once: true })
  try {
    const solved = await cap.solve()
    if (stopped()) {
      return { ok: false, failure: 'stopped' }
    }
    if (solved?.success === true && solved.token !== '') {
      return { ok: true, token: solved.token }
    }
    return refusal(reported ?? { code: 'unknown', message: '' })
  } catch (error) {
    if (stopped()) {
      return { ok: false, failure: 'stopped' }
    }
    return refusal(reported ?? capProblemFrom(error))
  } finally {
    signal?.removeEventListener('abort', stop)
    stop()
  }
}
