import { useMemo, useState, type ReactNode } from 'react'
import type { DownloadGame } from '../download'
import { DownloadAreaContext } from '../use-download-area'
import { DownloadSettingsDialog } from './download-settings-dialog'

type DownloadAreaProps = {
  game: DownloadGame
  banner?: ReactNode
  children: ReactNode
}

export function DownloadArea({ game, banner, children }: DownloadAreaProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { title, b_id: bangumiId, v_id: vndbId, h_id: hikarinagiId } = game
  const area = useMemo(
    () => ({
      game: { title, b_id: bangumiId, v_id: vndbId, h_id: hikarinagiId },
      openSettings: () => setSettingsOpen(true),
      banner,
    }),
    [title, bangumiId, vndbId, hikarinagiId, banner],
  )
  return (
    <DownloadAreaContext value={area}>
      {children}
      <DownloadSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </DownloadAreaContext>
  )
}
