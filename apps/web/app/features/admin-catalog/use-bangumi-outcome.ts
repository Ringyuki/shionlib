import { toast } from '@hina-ui/react'
import { useEffect, useEffectEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslations } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { bangumiOutcomeParam, type BangumiOutcome } from './admin-catalog'
import { outcomeFrom } from './admin-catalog.schema'

export function useBangumiOutcome() {
  const t = useTranslations('adminCatalog.bangumi')
  const [params] = useSearchParams()
  const stay = useInPageNavigate()
  const outcome = outcomeFrom(params.get(bangumiOutcomeParam))
  const report = useEffectEvent((settled: BangumiOutcome) => {
    if (settled === 'authorized') {
      toast.success(t('authorizedNow'), { id: bangumiOutcomeParam })
    } else {
      toast.danger(t('failedNow'), { id: bangumiOutcomeParam })
    }
    const next = new URLSearchParams(params)
    next.delete(bangumiOutcomeParam)
    stay(`?${next}`, { replace: true })
  })
  useEffect(() => {
    if (outcome !== undefined) {
      report(outcome)
    }
  }, [outcome])
}
