import type { ApiClient } from '~/shared/api/client'
import type { CheckResult } from './admin-ai-route'
import type { RouteChange } from './admin-ai-route.schema'

export async function changeRoute(
  api: ApiClient,
  change: RouteChange,
): Promise<CheckResult | null> {
  switch (change.action) {
    case 'check':
      return api.post('/admin/ai/routes/{id}/checks', { params: { path: { id: change.id } } })
    case 'update': {
      const { upstreamId, protocol, status, priceManual, inputPrice, outputPrice } = change.changes
      await api.patch('/admin/ai/routes/{id}', {
        params: { path: { id: change.id } },
        body: {
          ...(upstreamId === undefined ? {} : { upstream_id: upstreamId }),
          ...(protocol === undefined ? {} : { protocol }),
          ...(status === undefined ? {} : { status }),
          ...(priceManual === undefined ? {} : { price_manual: priceManual }),
          ...(inputPrice === undefined ? {} : { input_price: inputPrice }),
          ...(outputPrice === undefined ? {} : { output_price: outputPrice }),
        },
      })
      return null
    }
    case 'remove':
      await api.delete('/admin/ai/routes/{id}', { params: { path: { id: change.id } } })
      return null
    case 'batch':
      await api.post('/admin/ai/routes/batch', {
        body: { ids: change.ids, action: change.operation },
      })
      return null
    case 'revert':
      await api.delete('/admin/ai/routes/{id}/adjustments/{adjustment_id}', {
        params: { path: { id: change.id, adjustment_id: change.adjustmentId } },
      })
      return null
  }
}
