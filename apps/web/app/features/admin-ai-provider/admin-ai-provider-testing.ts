import type { Discovered, Provider, ProviderDetail } from './admin-ai-provider'

const at = '2026-10-12T06:22:00.000Z'

export function provider(id: number, changes: Partial<Provider> = {}): Provider {
  return {
    id,
    name: `provider-${id}`,
    kind: 'compatible',
    base_url: 'https://llm.example.net/v1',
    key_hint: 'sk-…0000',
    price_multiplier: 1,
    catalog_provider_id: null,
    enabled: true,
    protocols: ['chat', 'responses', 'messages', 'gemini', 'moderation'],
    route_counts: { total: 1, active: 1, suspended: 0, disabled: 0 },
    suspended_kinds: [],
    upstream_ids: [],
    stats: { requests: 0, failures: 0, first_token_ms: null, cost_usd: 0 },
    last_used_at: null,
    created: at,
    updated: at,
    ...changes,
  }
}

export function detail(id: number, routes: ProviderDetail['routes'] = []): ProviderDetail {
  return { ...provider(id), routes }
}

export function discovered(upstreamId: string, changes: Partial<Discovered> = {}): Discovered {
  return {
    upstream_id: upstreamId,
    name: upstreamId,
    canonical_id: null,
    lab: null,
    model_id: null,
    route_id: null,
    protocol: 'chat',
    protocols: ['chat'],
    moderation: false,
    reasoning: false,
    tool_call: false,
    vision: false,
    context_limit: null,
    input_price: null,
    output_price: null,
    ...changes,
  }
}
