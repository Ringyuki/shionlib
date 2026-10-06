export class Slots {
  private free: number
  private readonly queue: Array<() => void> = []

  constructor(size: number) {
    this.free = size
  }

  acquire(signal: AbortSignal): Promise<void> {
    if (signal.aborted) {
      return Promise.reject(signal.reason)
    }
    if (this.free > 0) {
      this.free--
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const grant = () => {
        signal.removeEventListener('abort', cancel)
        resolve()
      }
      const cancel = () => {
        this.queue.splice(this.queue.indexOf(grant), 1)
        reject(signal.reason)
      }
      this.queue.push(grant)
      signal.addEventListener('abort', cancel, { once: true })
    })
  }

  release() {
    const next = this.queue.shift()
    if (next === undefined) {
      this.free++
    } else {
      next()
    }
  }
}

export function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(signal.reason)
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel)
      resolve()
    }, milliseconds)
    const cancel = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', cancel, { once: true })
  })
}
