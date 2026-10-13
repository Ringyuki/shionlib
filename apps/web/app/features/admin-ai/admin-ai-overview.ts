import type { ChartBar, ChartTone } from '~/features/admin'
import type { Schema } from '~/shared/api/types'
import { hostOf, noStats, type Range, type Stats } from './admin-ai'

export type Usage = Schema<'AiOverviewDTO'>

export type CostSeries = Schema<'AiCostSeriesDTO'>

export type BreakdownRow = Schema<'AiBreakdownRowDTO'>

export type Scene = Schema<'AiSceneDTO'>

export type Provider = Schema<'AiProviderDTO'>

export type FailedCall = Schema<'AiRequestDTO'>

export type SceneUsage = {
  key: string
  label: string
  model: string | undefined
  stats: Stats
}

export type ProviderUsage = {
  provider: Provider
  host: string
  stats: Stats
}

export type Overview = {
  range: Range
  usage: Usage
  series: CostSeries
  scenes: SceneUsage[]
  providers: ProviderUsage[]
  failures: FailedCall[]
}

export const failuresShown = 5

function statsOf(rows: readonly BreakdownRow[], key: string): Stats {
  const row = rows.find(candidate => candidate.key === key)
  return row === undefined
    ? noStats
    : {
        requests: row.requests,
        failures: row.failures,
        first_token_ms: row.first_token_ms,
        cost_usd: row.cost_usd,
      }
}

export function sceneUsage(scenes: readonly Scene[], rows: readonly BreakdownRow[]): SceneUsage[] {
  return scenes.map(scene => ({
    key: scene.key,
    label: scene.label,
    model: scene.effective?.name,
    stats: statsOf(rows, scene.key),
  }))
}

export function providerUsage(
  providers: readonly Provider[],
  rows: readonly BreakdownRow[],
): ProviderUsage[] {
  return providers.map(provider => ({
    provider,
    host: hostOf(provider),
    stats: statsOf(rows, String(provider.id)),
  }))
}

export type Change = { direction: 'more' | 'less' | 'same'; share: number } | undefined

export function changeOf(current: number, previous: number): Change {
  if (previous === 0) {
    return undefined
  }
  const share = Math.abs(current - previous) / previous
  if (current === previous) {
    return { direction: 'same', share: 0 }
  }
  return { direction: current > previous ? 'more' : 'less', share }
}

export function requestBars(series: CostSeries, names: { ok: string; failed: string }): ChartBar[] {
  const buckets = series.buckets ?? []
  return [
    { name: names.ok, tone: 'accent', values: buckets.map(b => b.requests - b.failures) },
    { name: names.failed, tone: 'danger', values: buckets.map(b => b.failures) },
  ]
}

const modelTones: readonly ChartTone[] = ['accent', 'warning', 'success', 'info', 'danger']

export function costBars(series: CostSeries, others: string): ChartBar[] {
  return (series.models ?? []).map((model, index) => ({
    name: model.label ?? others,
    tone: model.model_id === null ? 'neutral' : (modelTones[index % modelTones.length] ?? 'accent'),
    values: model.costs ?? [],
  }))
}

export const dayMs = 86_400_000

export function spansDays(series: Pick<CostSeries, 'bucket_ms'>): boolean {
  return series.bucket_ms >= dayMs
}
