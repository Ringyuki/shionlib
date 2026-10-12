import type { Route } from './admin-ai-route'

const at = '2026-10-12T06:22:00.000Z'

export function route(id: number, changes: Partial<Route> = {}): Route {
  return {
    id,
    model: { id: 1, key: 'gpt-5-mini', name: 'gpt-5-mini', moderation: false },
    provider: { id: 1, kind: 'compatible', name: 'OpenRouter' },
    upstream_id: 'openai/gpt-5-mini',
    protocol: 'chat',
    price_manual: false,
    input_price: 0.25,
    output_price: 2,
    cache_read_price: null,
    cache_write_price: null,
    price_tiers: [],
    dropped_params: [],
    json_mode: false,
    priority: 0,
    status: 'active',
    status_kind: null,
    status_message: null,
    status_at: null,
    adjustments: [],
    offered: null,
    last: null,
    stats: { requests: 0, failures: 0, first_token_ms: null, cost_usd: 0 },
    created: at,
    updated: at,
    ...changes,
  }
}
