const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export type TurnstileFailure = 'unavailable' | 'error' | 'expired' | 'timeout'

export type TurnstileOptions = {
  sitekey: string
  action: string
  theme: 'light' | 'dark' | 'auto'
  language: string
  appearance: 'always' | 'execute' | 'interaction-only'
  retry: 'auto' | 'never'
  callback: (token: string) => void
  'error-callback': () => boolean
  'expired-callback': () => void
  'timeout-callback': () => void
}

export type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string | undefined
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | undefined

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile !== undefined) {
    return Promise.resolve(window.turnstile)
  }
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.onload = () => {
      if (window.turnstile === undefined) {
        reject(new Error('Turnstile did not start'))
        return
      }
      resolve(window.turnstile)
    }
    script.onerror = () => {
      loading = undefined
      script.remove()
      reject(new Error('Turnstile failed to load'))
    }
    document.head.append(script)
  })
  return loading
}
