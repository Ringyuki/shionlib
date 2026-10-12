import type { CatalogOffer, Model } from './admin-ai-model'

const at = '2026-10-12T06:22:00.000Z'

export function model(id: number, changes: Partial<Model> = {}): Model {
  return {
    id,
    key: `model-${id}`,
    name: `model-${id}`,
    description: null,
    canonical_id: null,
    enabled: true,
    is_default: false,
    moderation: false,
    reasoning: false,
    vision: false,
    temperature: true,
    tool_call: false,
    context_limit: null,
    output_limit: null,
    routes: [],
    scenes: [],
    stats: { requests: 0, failures: 0, first_token_ms: null, cost_usd: 0 },
    created: at,
    updated: at,
    ...changes,
  }
}

export function offer(providerId: number, upstreamId: string): CatalogOffer {
  return {
    provider: { id: providerId, kind: 'compatible', name: `provider-${providerId}` },
    upstream_id: upstreamId,
    protocol: 'chat',
    protocols: ['chat'],
    input_price: 0.25,
    output_price: 2,
  }
}
