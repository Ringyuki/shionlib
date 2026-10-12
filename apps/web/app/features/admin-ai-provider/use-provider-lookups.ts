import { useEffect, useEffectEvent } from 'react'
import { href, useFetcher } from 'react-router'
import type { ProviderKind } from '~/features/admin-ai'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { aiEndpointLoader, aiPresetsLoader, aiResolveLoader } from './admin-ai-provider.server'

const settleDelay = 400

function useSettled(key: string, enabled: boolean, load: () => void) {
  const run = useEffectEvent(load)
  useEffect(() => {
    if (!enabled) {
      return
    }
    const timer = window.setTimeout(run, settleDelay)
    return () => window.clearTimeout(timer)
  }, [key, enabled])
}

export function usePresets(wanted: boolean) {
  const presets = useLazyLoad(useFetcher<typeof aiPresetsLoader>())
  const load = useEffectEvent(
    () => void presets.load(href('/resources/admin/ai/catalog/providers')),
  )
  useEffect(() => {
    if (wanted) {
      load()
    }
  }, [wanted])
  return { presets: presets.result ?? [], loading: presets.loading }
}

export function useEndpoint(kind: ProviderKind, baseUrl: string, wanted: boolean) {
  const endpoint = useLazyLoad(useFetcher<typeof aiEndpointLoader>())
  const search = new URLSearchParams({ kind, base_url: baseUrl.trim() }).toString()
  useSettled(
    search,
    wanted,
    () => void endpoint.load(`${href('/resources/admin/ai/providers/endpoint')}?${search}`),
  )
  return endpoint.result
}

export function useResolved(provider: number, upstreamId: string, wanted: boolean) {
  const resolved = useLazyLoad(useFetcher<typeof aiResolveLoader>())
  const upstream = upstreamId.trim()
  const search = new URLSearchParams({ provider: String(provider), upstream }).toString()
  useSettled(
    search,
    wanted && upstream !== '',
    () => void resolved.load(`${href('/resources/admin/ai/providers/resolve')}?${search}`),
  )
  return upstream === '' || resolved.result?.upstream_id !== upstream ? undefined : resolved.result
}
