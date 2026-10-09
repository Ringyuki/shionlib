import { createContext, useContext, type ReactNode } from 'react'

export type PublicConfig = {
  imageBaseUrl: string
  hikarinagiSiteUrl: string
  capEndpoint: string
}

const PublicConfigContext = createContext<PublicConfig>({
  imageBaseUrl: '',
  hikarinagiSiteUrl: '',
  capEndpoint: '',
})

export function PublicConfigProvider({
  config,
  children,
}: {
  config: PublicConfig
  children: ReactNode
}) {
  return <PublicConfigContext value={config}>{children}</PublicConfigContext>
}

export function usePublicConfig(): PublicConfig {
  return useContext(PublicConfigContext)
}
