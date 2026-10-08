import { toast } from '@hina-ui/react'
import { useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useTranslations } from 'use-intl'
import { useCommand } from '~/shared/route/use-command'
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
  const settings = useDownloadSettings()
  const issue = useCommand(
    useFetcher<typeof downloadLinkAction>(),
    href('/resources/download/link'),
    { revalidate: false },
  )
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

  const verified = async (token: string) => {
    setVerifying(false)
    const chosen = intent
    const request: IssueLink = { fileId: file.id, token }
    const outcome = await issue.run(request)
    if (!outcome.ok) {
      return
    }
    const { file_url: url, expires_in: expiry } = outcome.result
    const link = { url, minutes: validMinutes(expiry) }
    if (chosen === 'copy') {
      void copy(link)
    } else if (chosen === 'aria2') {
      void pushToDownloader(link)
    } else {
      openInBrowser(link)
    }
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

  return {
    preferred: settings.method,
    verifying,
    busy: verifying || issue.pending,
    start,
    cancel,
    verified,
    failed,
  }
}
