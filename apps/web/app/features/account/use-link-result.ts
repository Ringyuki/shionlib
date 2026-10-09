import { toast } from '@hina-ui/react'
import { useEffect, useEffectEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslations } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { knownLinkError, linkErrorParam, linkedParam, type LinkResult } from './account'

export function useLinkResult(result: LinkResult | undefined) {
  const t = useTranslations('account.identity')
  const [params] = useSearchParams()
  const stay = useInPageNavigate()
  const report = useEffectEvent((settled: LinkResult) => {
    if (settled.linked) {
      toast.success(t('linked'), { id: linkedParam })
    } else {
      const known = knownLinkError(settled.reason)
      toast.danger(known === undefined ? t('linkFailed') : t(`linkError.${known}`), {
        id: linkErrorParam,
        description: t('linkReason', { reason: settled.reason ?? '' }),
      })
    }
    const next = new URLSearchParams(params)
    next.delete(linkedParam)
    next.delete(linkErrorParam)
    stay(`?${next}`, { replace: true })
  })
  useEffect(() => {
    if (result !== undefined) {
      report(result)
    }
  }, [result])
}
