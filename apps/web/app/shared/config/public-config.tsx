import { createContext, useContext, type ReactNode } from 'react'

export type PublicConfig = {
  imageBaseUrl: string
  imageBucketUrl: string
  imageProcessorUrl: string
  hikarinagiSiteUrl: string
  capEndpoint: string
  siteUrl: string
  ogImageUrl: string
}

const PublicConfigContext = createContext<PublicConfig>({
  imageBaseUrl: '',
  imageBucketUrl: '',
  imageProcessorUrl: '',
  hikarinagiSiteUrl: '',
  capEndpoint: '',
  siteUrl: '',
  ogImageUrl: '',
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
