import { Popover, PopoverTrigger, PopoverContent } from '@/components/shionui/Popover'
import { useTranslations } from 'next-intl'
import { useState, useRef } from 'react'
import { flushSync, createPortal } from 'react-dom'
import { GetDownloadLinkHandle, GetDownloadLink } from '../libs/get-download-link'
import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'
import { addUrl } from '../helpers/aria2'
import { buildLunaBoxUrl, openLunaBox } from '../helpers/lunabox'
import { useAria2Store } from '@/store/localSettingsStore'
import { sileo } from 'sileo'
import { useRouter } from '@/i18n/navigation.client'
import { Aria2 } from './Aria2'
import { Normal } from './Normal'
import { LunaBox } from './LunaBox'
import { useGameDownloadMeta } from '../GameDownloadContext'
import { useLunaBoxStore } from '@/store/localSettingsStore'

interface DownloadWaysProps {
  file: GameDownloadResourceFile
  onTurnstileOpenChange: (open: boolean) => void
  downloadLink: string | null
  setDownloadLink: (link: string | null) => void
}

export const DownloadWays = ({
  file,
  onTurnstileOpenChange,
  downloadLink,
  setDownloadLink,
}: DownloadWaysProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')
  const { getSettings } = useAria2Store()
  const { protocol, host, port, path, auth_secret, downloadPath } = getSettings()
  const router = useRouter()
  const { game_title, bangumi_id } = useGameDownloadMeta()
  const showLunaBox = useLunaBoxStore(state => state.showLunaBox)
  const [pushToAria2Loading, setPushToAria2Loading] = useState(false)
  const [normalDownloadLoading, setNormalDownloadLoading] = useState(false)
  const [lunaBoxLoading, setLunaBoxLoading] = useState(false)
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
  const handlePushToAria2 = async () => {
    setPushToAria2Loading(true)
    const url = await requestDownloadLink()
    if (!url) {
      setPushToAria2Loading(false)
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
      setPushToAria2Loading(false)
      return
    }

    sileo.success({ title: t('downloadStarted') })
    setPushToAria2Loading(false)
  }
  const handleNormalDownload = async () => {
    setNormalDownloadLoading(true)
    const url = await requestDownloadLink()
    setNormalDownloadLoading(false)
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
    setLunaBoxLoading(true)
    const url = await requestDownloadLink()
    setLunaBoxLoading(false)
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
    openLunaBox(lunaBoxUrl)
    sileo.success({ title: t('downloadStarted') })
  }

  const handleTurnstileCancel = () => {
    downloadLinkRef.current?.cancelRequest?.()
    setTurnstileOpen(false)
    onTurnstileOpenChange(false)
    setPushToAria2Loading(false)
    setNormalDownloadLoading(false)
    setLunaBoxLoading(false)
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
        <PopoverTrigger asChild>
          <div className="flex gap-2">
            <Aria2 pushToAria2Loading={pushToAria2Loading} handlePushToAria2={handlePushToAria2} />
            {showLunaBox && (
              <LunaBox lunaBoxLoading={lunaBoxLoading} handleLunaBox={handleLunaBox} />
            )}
            <Normal
              normalDownloadLoading={normalDownloadLoading}
              handleNormalDownload={handleNormalDownload}
            />
          </div>
        </PopoverTrigger>
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
