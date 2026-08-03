import { Popover, PopoverAnchor, PopoverContent } from '@/components/shionui/Popover'
import { useTranslations } from 'next-intl'
import { useState, useRef } from 'react'
import { flushSync, createPortal } from 'react-dom'
import { GetDownloadLinkHandle, GetDownloadLink } from '../libs/get-download-link'
import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'
import { addUrl } from '../helpers/aria2'
import { buildLunaBoxUrl } from '../helpers/lunabox'
import { buildReinaUrl } from '../helpers/reina'
import { openProtocolUrl } from '../helpers/protocol'
import { useAria2Store } from '@/store/localSettingsStore'
import { sileo } from 'sileo'
import { useRouter } from '@/i18n/navigation.client'
import { PushMenu } from './PushMenu'
import { Aria2 } from './Aria2'
import { Normal } from './Normal'
import { LunaBox } from './LunaBox'
import { Reina } from './Reina'
import { useGameDownloadMeta } from '../GameDownloadContext'
import { useLunaBoxStore, useReinaStore } from '@/store/localSettingsStore'

type PendingWay = 'aria2' | 'lunabox' | 'reina' | 'normal'

interface DownloadWaysProps {
  file: GameDownloadResourceFile
  resourceId: number
  onTurnstileOpenChange: (open: boolean) => void
  downloadLink: string | null
  setDownloadLink: (link: string | null) => void
}

export const DownloadWays = ({
  file,
  resourceId,
  onTurnstileOpenChange,
  downloadLink,
  setDownloadLink,
}: DownloadWaysProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')
  const { getSettings } = useAria2Store()
  const { protocol, host, port, path, auth_secret, downloadPath } = getSettings()
  const router = useRouter()
  const { game_title, bangumi_id, vndb_id } = useGameDownloadMeta()
  const showLunaBox = useLunaBoxStore(state => state.showLunaBox)
  const showReina = useReinaStore(state => state.showReina)
  const [pending, setPending] = useState<PendingWay | null>(null)
  const [pushMenuOpen, setPushMenuOpen] = useState(false)
  const downloadLinkRef = useRef<GetDownloadLinkHandle>(null)
  const downloadLinkExpiresAt = useRef(0)
  const [turnstileOpen, setTurnstileOpen] = useState(false)

  const requestDownloadLink = async () => {
    if (downloadLink) return downloadLink
    flushSync(() => {
      setTurnstileOpen(true)
      onTurnstileOpenChange(true)
    })
    const url = await downloadLinkRef.current?.requestLink()
    setTurnstileOpen(false)
    onTurnstileOpenChange(false)
    setDownloadLink(url ?? null)
    return url ?? null
  }
  const startPush = (way: PendingWay) => {
    setPushMenuOpen(false)
    setPending(way)
  }
  const handlePushToAria2 = async () => {
    startPush('aria2')
    const url = await requestDownloadLink()
    if (!url) {
      setPending(null)
      return
    }

    const res = await addUrl(
      url,
      file.file_name,
      protocol,
      host,
      port,
      path,
      auth_secret,
      downloadPath,
    )
    if (!res.success) {
      sileo.error({
        title: t(res.message ?? 'aria2UnknownError'),
        description: t('goToSettingsDescription'),
        styles: {
          description: 'dark:text-background',
        },
        button: {
          title: t('goToSettings'),
          onClick: () => router.push('/user/settings/download'),
        },
      })
      setPending(null)
      return
    }

    sileo.success({ title: t('downloadStarted') })
    setPending(null)
  }
  const handleNormalDownload = async () => {
    setPending('normal')
    const url = await requestDownloadLink()
    setPending(null)
    if (!url) return

    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    sileo.success({ title: t('downloadStarted') })
  }
  const handleLunaBox = async () => {
    startPush('lunabox')
    const url = await requestDownloadLink()
    setPending(null)
    if (!url) return

    const lunaBoxUrl = buildLunaBoxUrl({
      url,
      fileName: file.file_name,
      size: file.file_size,
      checksumAlgo: file.hash_algorithm,
      checksum: file.file_hash,
      expiresAt: downloadLinkExpiresAt.current,
      title: game_title,
      bangumiId: bangumi_id,
    })
    openProtocolUrl(lunaBoxUrl)
    sileo.success({ title: t('downloadStarted') })
  }
  const handleReina = async () => {
    if (!bangumi_id) return
    startPush('reina')
    const url = await requestDownloadLink()
    setPending(null)
    if (!url) return

    const reinaUrl = buildReinaUrl({
      resourceId,
      url,
      fileName: file.file_name,
      size: file.file_size,
      checksumAlgo: file.hash_algorithm,
      checksum: file.file_hash,
      expiresAt: downloadLinkExpiresAt.current,
      title: game_title ?? file.file_name,
      bangumiId: bangumi_id,
      vndbId: vndb_id,
    })
    openProtocolUrl(reinaUrl)
    sileo.success({ title: t('downloadStarted') })
  }

  const handleTurnstileCancel = () => {
    downloadLinkRef.current?.cancelRequest?.()
    setTurnstileOpen(false)
    onTurnstileOpenChange(false)
    setPending(null)
  }

  const overlay =
    turnstileOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed left-0 top-0 w-screen h-dvh z-60 pointer-events-auto bg-transparent"
            onClick={handleTurnstileCancel}
            aria-label="turnstile overlay"
          />,
          document.body,
        )
      : null

  return (
    <>
      {overlay}
      <Popover open={turnstileOpen}>
        <PopoverAnchor asChild>
          <div className="flex gap-2">
            <PushMenu
              open={pushMenuOpen}
              onOpenChange={setPushMenuOpen}
              loading={pending !== null && pending !== 'normal'}
            >
              <Aria2
                pushToAria2Loading={pending === 'aria2'}
                handlePushToAria2={handlePushToAria2}
              />
              {showLunaBox && (
                <LunaBox lunaBoxLoading={pending === 'lunabox'} handleLunaBox={handleLunaBox} />
              )}
              {showReina && (
                <Reina
                  reinaLoading={pending === 'reina'}
                  handleReina={handleReina}
                  disabled={!bangumi_id}
                />
              )}
            </PushMenu>
            <Normal
              normalDownloadLoading={pending === 'normal'}
              handleNormalDownload={handleNormalDownload}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent className="w-[320px] h-[170px] z-70" sideOffset={8}>
          <GetDownloadLink
            fileId={file.id}
            ref={downloadLinkRef}
            onLink={(url, expiresAt) => {
              setDownloadLink(url)
              downloadLinkExpiresAt.current = expiresAt
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}
