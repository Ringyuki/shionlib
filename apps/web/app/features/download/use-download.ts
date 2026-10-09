import { toast } from '@hina-ui/react'
import { useRef, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useTranslations } from 'use-intl'
import { usePublicConfig } from '~/shared/config/public-config'
import { useCommand } from '~/shared/route/use-command'
import { solveCap } from '~/shared/vendor/cap'
import {
  linkOf,
  offeredMethods,
  preferredMethod,
  usableFor,
  type DownloadIntent,
  type DownloadSubject,
} from './download'
import type { IssueLink } from './download.schema'
import type { downloadLinkAction } from './download.server'
import { useDelivery } from './use-delivery'
import { useDownloadArea } from './use-download-area'
import { useDownloadSettings } from './use-download-settings'

export function useDownload(subject: DownloadSubject) {
  const t = useTranslations('download')
  const settings = useDownloadSettings()
  const area = useDownloadArea()
  const { capEndpoint } = usePublicConfig()
  const issue = useCommand(
    useFetcher<typeof downloadLinkAction>(),
    href('/resources/download/link'),
    { revalidate: false },
  )
  const deliver = useDelivery(subject, settings, area?.game)
  const [preparing, setPreparing] = useState(false)
  const [progress, setProgress] = useState(0)
  const running = useRef<AbortController | null>(null)

  const cancel = () => {
    running.current?.abort()
    running.current = null
    setPreparing(false)
  }

  const verifiedLink = async (signal: AbortSignal) => {
    const solved = await solveCap(capEndpoint, { signal, onProgress: setProgress })
    if (signal.aborted) {
      return undefined
    }
    if (!solved.ok) {
      if (solved.failure !== 'stopped') {
        const code = solved.message === '' ? solved.code : `${solved.code} (${solved.message})`
        toast.danger(t(`verification.${solved.failure}`), { description: t('problem', { code }) })
      }
      return undefined
    }
    const request: IssueLink = { fileId: subject.file.id, token: solved.token }
    const outcome = await issue.run(request)
    return outcome.ok
      ? linkOf(outcome.result.file_url, outcome.result.expires_in, new Date())
      : undefined
  }

  const start = async (intent: DownloadIntent) => {
    running.current?.abort()
    const control = new AbortController()
    running.current = control
    setProgress(0)
    setPreparing(true)
    const link = await verifiedLink(control.signal)
    if (running.current !== control) {
      return
    }
    running.current = null
    setPreparing(false)
    if (link !== undefined) {
      deliver(intent, link)
    }
  }

  return {
    methods: offeredMethods(settings).map(method => ({
      method,
      usable: usableFor(method, area?.game),
    })),
    preferred: preferredMethod(settings, area?.game),
    openSettings: area?.openSettings,
    preparing,
    progress,
    busy: preparing || issue.pending,
    start: (intent: DownloadIntent) => void start(intent),
    cancel,
  }
}

export type Download = ReturnType<typeof useDownload>
