import { createContext, useContext, type ReactNode } from 'react'

export type PublicConfig = {
  imageBaseUrl: string
  imageBucketUrl: string
  imageProcessorUrl: string
  hikarinagiSiteUrl: string
  capEndpoint: string
}

const PublicConfigContext = createContext<PublicConfig>({
  imageBaseUrl: '',
  imageBucketUrl: '',
  imageProcessorUrl: '',
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
