import { toast } from '@hina-ui/react'
import { useEffect, useEffectEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslations } from 'use-intl'
import { knownLinkError, linkErrorParam, linkedParam, type LinkResult } from './account'

export function useLinkResult(result: LinkResult | undefined) {
  const t = useTranslations('account.identity')
  const [, setParams] = useSearchParams()
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
    setParams(
      current => {
        const next = new URLSearchParams(current)
        next.delete(linkedParam)
        next.delete(linkErrorParam)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  })
  useEffect(() => {
    if (result !== undefined) {
      report(result)
    }
  }, [result])
}
