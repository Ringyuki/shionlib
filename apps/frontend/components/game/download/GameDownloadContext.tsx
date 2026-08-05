import { createContext, useContext } from 'react'

interface GameDownloadMetaContextValue {
  game_title?: string
  bangumi_id?: string
  vndb_id?: string
  hikarinagi_id?: number
}

export const GameDownloadMetaContext = createContext<GameDownloadMetaContextValue>({})

export const useGameDownloadMeta = () => useContext(GameDownloadMetaContext)
