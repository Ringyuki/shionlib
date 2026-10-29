export type LinkedSignal = { signal: AbortSignal; release: () => void }

export function linkSignals(sources: readonly AbortSignal[]): LinkedSignal {
  const controller = new AbortController()
  const links = new Map<AbortSignal, () => void>()
  const release = () => {
    links.forEach((follow, source) => source.removeEventListener('abort', follow))
    links.clear()
  }
  const abortedSource = sources.find(source => source.aborted)
  if (abortedSource !== undefined) {
    controller.abort(abortedSource.reason)
    return { signal: controller.signal, release }
  }
  for (const source of sources) {
    const follow = () => {
      release()
      controller.abort(source.reason)
    }
    links.set(source, follow)
    source.addEventListener('abort', follow, { once: true })
  }
  return { signal: controller.signal, release }
}
