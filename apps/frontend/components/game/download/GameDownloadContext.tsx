import { createContext, useContext } from 'react'

interface GameDownloadMetaContextValue {
  game_title?: string
  bangumi_id?: string
}

export const GameDownloadMetaContext = createContext<GameDownloadMetaContextValue>({})

export const useGameDownloadMeta = () => useContext(GameDownloadMetaContext)
