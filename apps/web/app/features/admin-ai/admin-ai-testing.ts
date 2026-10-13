import type { Schema } from '~/shared/api/types'
import type { Stats } from './admin-ai'

type Route = Schema<'AiRouteDTO'>

type Model = Schema<'AiModelDTO'>

type Provider = Schema<'AiProviderDTO'>

type Scene = Schema<'AiSceneDTO'>

type Logged = Schema<'AiRequestDTO'>

const at = '2026-10-12T06:22:00.000Z'

export function stats(changes: Partial<Stats> = {}): Stats {
  return { requests: 0, failures: 0, first_token_ms: null, cost_usd: 0, ...changes }
}

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
    stats: stats(),
    last_used_at: null,
    created: at,
    updated: at,
    ...changes,
  }
}

export function route(id: number, changes: Partial<Route> = {}): Route {
  return {
    id,
    model: { id: 1, key: 'gpt-5-mini', name: 'gpt-5-mini', moderation: false },
    provider: { id: 1, kind: 'compatible', name: 'provider-1' },
    upstream_id: 'gpt-5-mini',
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
    stats: stats(),
    created: at,
    updated: at,
    ...changes,
  }
}

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
    stats: stats(),
    created: at,
    updated: at,
    ...changes,
  }
}

export function scene(key: string, changes: Partial<Scene> = {}): Scene {
  return {
    key,
    label: key,
    output: 'object',
    model: null,
    effective: null,
    temperature: null,
    max_output_tokens: null,
    timeout_ms: null,
    problem: null,
    stats: stats(),
    ...changes,
  }
}

export function logged(id: string, changes: Partial<Logged> = {}): Logged {
  return {
    id,
    call_id: `call-${id}`,
    source: 'scene',
    scene: 'moderation_review',
    model: { id: 1, key: 'gpt-5-mini', name: 'gpt-5-mini', moderation: false },
    route_id: 1,
    provider: { id: 1, kind: 'compatible', name: 'provider-1' },
    upstream_id: 'gpt-5-mini',
    protocol: 'chat',
    ok: true,
    error_kind: null,
    error_message: null,
    adaptation: null,
    first_token_ms: 400,
    duration_ms: 1800,
    input_tokens: 1200,
    output_tokens: 96,
    cache_read_tokens: 0,
    cost_usd: 0.0005,
    created: at,
    ...changes,
  }
}
