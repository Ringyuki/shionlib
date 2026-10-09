import { useMemo, useState, type ReactNode } from 'react'
import type { DownloadGame } from '../download'
import { DownloadAreaContext } from '../use-download-area'
import { DownloadSettingsDialog } from './download-settings-dialog'

type DownloadAreaProps = {
  game: DownloadGame
  children: ReactNode
}

export function DownloadArea({ game, children }: DownloadAreaProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { title, b_id: bangumiId, v_id: vndbId, h_id: hikarinagiId } = game
  const area = useMemo(
    () => ({
      game: { title, b_id: bangumiId, v_id: vndbId, h_id: hikarinagiId },
      openSettings: () => setSettingsOpen(true),
    }),
    [title, bangumiId, vndbId, hikarinagiId],
  )
  return (
    <DownloadAreaContext value={area}>
      {children}
      <DownloadSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </DownloadAreaContext>
  )
}
