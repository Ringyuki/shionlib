import { toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { pushToAria2 } from '~/shared/vendor/aria2'
import {
  isManager,
  managerNames,
  managerUrl,
  openManager,
  type Manager,
} from '~/shared/vendor/managers'
import {
  installOf,
  type DownloadGame,
  type DownloadIntent,
  type DownloadLink,
  type DownloadSettings,
  type DownloadSubject,
} from './download'

export function useDelivery(
  subject: DownloadSubject,
  settings: DownloadSettings,
  game: DownloadGame | undefined,
) {
  const t = useTranslations('download')

  const openInBrowser = (link: DownloadLink) => window.location.assign(link.url)

  const pushToDownloader = async (link: DownloadLink) => {
    const { aria2 } = settings
    const outcome = await pushToAria2(aria2, { url: link.url, fileName: subject.file.file_name })
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

  const handToManager = (manager: Manager, link: DownloadLink) => {
    const url = managerUrl(manager, installOf(link, subject, game))
    if (url === undefined) {
      openInBrowser(link)
      return
    }
    openManager(url)
    const name = managerNames[manager]
    toast.success(t('manager.sent', { name }), {
      description: t('manager.hint', { name }),
      action: { label: t('useBrowser'), onClick: () => openInBrowser(link) },
    })
  }

  const copy = async (link: DownloadLink) => {
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

  return (intent: DownloadIntent, link: DownloadLink) => {
    if (intent === 'copy') {
      void copy(link)
    } else if (intent === 'aria2') {
      void pushToDownloader(link)
    } else if (isManager(intent)) {
      handToManager(intent, link)
    } else {
      openInBrowser(link)
    }
  }
}
