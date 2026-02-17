import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'
import { useTranslations } from 'next-intl'
import { FileArchive, CloudCheck, Hash, Zap, Globe, CloudUpload } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shionui/Popover'
import { Button } from '@/components/shionui/Button'
import { Badge } from '@/components/shionui/Badge'
import { formatBytes } from '@/utils/format'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { addUrl } from './helpers/aria2'
import { useAria2Store } from '@/store/localSettingsStore'
import { CopyButton } from '@/components/shionui/animated/CopyButton'
import { GetDownloadLink, GetDownloadLinkHandle } from './libs/get-download-link'
import { Link, useRouter } from '@/i18n/navigation.client'
import { Question } from '@/components/common/content/Question'

interface GameDownloadFileItemProps {
  file: GameDownloadResourceFile
  onTurnstileOpenChange: (open: boolean) => void
}

export const GameDownloadFileItem = ({
  file,
  onTurnstileOpenChange,
}: GameDownloadFileItemProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')
  const [pushToAria2Loading, setPushToAria2Loading] = useState(false)
  const [normalDownloadLoading, setNormalDownloadLoading] = useState(false)
  const [downloadLink, setDownloadLink] = useState<string | null>(null)
  const { getSettings } = useAria2Store()
  const { protocol, host, port, path, auth_secret, downloadPath } = getSettings()
  const router = useRouter()
  const downloadLinkRef = useRef<GetDownloadLinkHandle>(null)
  const [turnstileOpen, setTurnstileOpen] = useState(false)

  const requestDownloadLink = async () => {
    if (downloadLink) return downloadLink
    setTurnstileOpen(true)
    onTurnstileOpenChange(true)
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
      // toast.error(
      //   <div className="flex flex-col gap-1">
      //     <span>{t(res.message ?? 'aria2UnknownError')}</span>
      //     <Link href="/user/settings/site" className="text-primary underline text-sm">
      //       {t('goToSettings')}
      //     </Link>
      //   </div>,
      // )
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

    // toast.success(t('downloadStarted'))
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

    // toast.success(t('downloadStarted'))
    sileo.success({ title: t('downloadStarted') })
  }

  const handleTurnstileCancel = () => {
    console.log('handleTurnstileCancel')
    downloadLinkRef.current?.cancelRequest?.()
    setTurnstileOpen(false)
    onTurnstileOpenChange(false)
    setPushToAria2Loading(false)
    setNormalDownloadLoading(false)
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
      <div className="flex gap-2 justify-between items-center border-dashed border p-2 rounded-lg">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium font-mono! flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <FileArchive className="size-3 shrink-0" />
              <span>{file.file_name}</span>
            </span>
            <span className="text-muted-foreground text-xs">{formatBytes(file.file_size)}</span>
            {file.type === 1 && (
              <Badge
                size="sm"
                variant={
                  file.file_status === 3
                    ? 'success'
                    : file.file_status === 2
                      ? 'warning'
                      : 'neutral'
                }
              >
                {file.file_status === 3 ? (
                  <CloudCheck className="size-3" />
                ) : (
                  <CloudUpload className="size-3" />
                )}
                {file.file_status === 3
                  ? 'S3'
                  : file.file_status === 2
                    ? t('processing')
                    : t('pending')}
              </Badge>
            )}
            {file.file_status !== 3 && (
              <Badge size="sm" variant="neutral">
                {t('onlyVisibleForYourself')}
              </Badge>
            )}
            {file.is_virus_false_positive && (
              <Badge size="sm" variant="destructive">
                {t('virusFalsePositiveFlag')}
                <Question
                  content={t('virusFalsePositiveFlagDescription', {
                    detected_viruses: file.malware_scan_cases
                      .map(c => c.detected_viruses)
                      .join(', '),
                  })}
                  iconClassName="text-white size-3"
                />
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground text-xs flex items-center gap-1 break-words break-all">
            <Hash className="size-3 shrink-0" />
            <span className="break-words break-all">
              {file.hash_algorithm === 'blake3' ? 'BLAKE3' : 'SHA-256'} {file.file_hash}
            </span>
            <CopyButton content={file.file_hash} size="xs" variant="ghost" />
          </div>
        </div>
        {file.file_status === 3 && (
          <Popover open={turnstileOpen}>
            <PopoverTrigger asChild>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      intent="primary"
                      appearance="soft"
                      size="icon"
                      className="size-8"
                      loading={pushToAria2Loading}
                      onClick={handlePushToAria2}
                      renderIcon={<Zap />}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>{t('pushToAria2')}</span>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      intent="neutral"
                      appearance="ghost"
                      size="icon"
                      className="size-8 text-secondary-foreground/50"
                      loading={normalDownloadLoading}
                      onClick={handleNormalDownload}
                      renderIcon={<Globe />}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>{t('normalDownload')}</span>
                  </TooltipContent>
                </Tooltip>
              </div>
            </PopoverTrigger>
            <PopoverContent forceMount className="w-[320px] h-[170px] z-[70]" sideOffset={8}>
              <GetDownloadLink
                fileId={file.id}
                ref={downloadLinkRef}
                onLink={url => setDownloadLink(url)}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </>
  )
}
