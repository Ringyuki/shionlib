import { toast } from '@hina-ui/react'
import { useEffect, useEffectEvent, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useTranslations } from 'use-intl'
import { pushToAria2 } from '~/shared/vendor/aria2'
import type { TurnstileFailure } from '~/shared/vendor/turnstile'
import { validMinutes, type DownloadIntent } from './download'
import type { IssueLink } from './download.schema'
import type { downloadLinkAction } from './download.server'
import { useDownloadSettings } from './use-download-settings'

type DownloadFile = {
  id: number
  name: string
}

type Link = {
  url: string
  minutes: number
}

export function useDownload(file: DownloadFile) {
  const t = useTranslations('download')
  const { settings } = useDownloadSettings()
  const fetcher = useFetcher<typeof downloadLinkAction>()
  const [intent, setIntent] = useState<DownloadIntent | undefined>(undefined)
  const [verifying, setVerifying] = useState(false)

  const start = (next: DownloadIntent) => {
    setIntent(next)
    setVerifying(true)
  }

  const cancel = () => {
    setVerifying(false)
    setIntent(undefined)
  }

  const verified = (token: string) => {
    setVerifying(false)
    const request: IssueLink = { fileId: file.id, token }
    void fetcher.submit(request, {
      method: 'post',
      action: href('/resources/download/link'),
      encType: 'application/json',
      defaultShouldRevalidate: false,
    })
  }

  const failed = (failure: TurnstileFailure) => {
    cancel()
    toast.danger(t(`verification.${failure}`))
  }

  const openInBrowser = (link: Link) => window.location.assign(link.url)

  const pushToDownloader = async (link: Link) => {
    const { aria2 } = settings
    const outcome = await pushToAria2(aria2, { url: link.url, fileName: file.name })
    if (outcome.ok) {
      toast.success(t('aria2.sent'))
      return
    }
    const message =
      outcome.reason === 'unreachable'
        ? t('aria2.unreachable', { endpoint: aria2.endpoint })
        : outcome.reason === 'unauthorized'
          ? t('aria2.unauthorized')
          : t('aria2.rejected', { message: outcome.message })
    toast.danger(message, {
      duration: 0,
      action: { label: t('useBrowser'), onClick: () => openInBrowser(link) },
    })
  }

  const copy = async (link: Link) => {
    try {
      await navigator.clipboard.writeText(link.url)
      toast.success(t('copied', { minutes: link.minutes }))
    } catch {
      toast(t('copyReady', { minutes: link.minutes }), {
        duration: 0,
        action: { label: t('copy'), onClick: () => void copy(link) },
      })
    }
  }

  const settled = fetcher.state === 'idle' ? fetcher.data : undefined

  const deliver = useEffectEvent((result: NonNullable<typeof settled>) => {
    const chosen = intent
    if (!result.ok) {
      toast.danger(
        result.retryAfter === undefined
          ? result.failure.message
          : t('retryAfter', { message: result.failure.message, seconds: result.retryAfter }),
      )
      return
    }
    const link = { url: result.result.file_url, minutes: validMinutes(result.result.expires_in) }
    if (chosen === 'copy') {
      void copy(link)
    } else if (chosen === 'aria2') {
      void pushToDownloader(link)
    } else {
      openInBrowser(link)
    }
  })

  useEffect(() => {
    if (settled !== undefined) {
      deliver(settled)
    }
  }, [settled])

  return {
    preferred: settings.method,
    verifying,
    busy: verifying || fetcher.state !== 'idle',
    start,
    cancel,
    verified,
    failed,
  }
}
