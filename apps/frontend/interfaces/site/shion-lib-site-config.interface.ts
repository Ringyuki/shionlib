import { SupportedLocales } from '@/config/i18n/supported'

export interface ShionlibSeoConfig {
  title: string
  titleShort: string
  description: string
  keywords: string[]
  image: string
  template: string
  canonical: string
  og: ShionlibSiteOpenGraph
  images?: ShionlibSiteImage[]
}

interface ShionlibSiteOpenGraph {
  title: string
  description: string
  image: string
  url: string
}

interface ShionlibSiteImage {
  url: string
  alt: string
  width: number
  height: number
}

export interface ShionlibSiteConfig {
  canonical: string
  robots: {
    index: boolean
    follow: boolean
  }
}

export interface NavBarLinkItem {
  type?: 'link'
  label: string
  href: string
  external?: boolean
  icon?: React.ReactNode
  gradientText?: boolean
  gradientTextColor?: string
  excludeLocales?: SupportedLocales[]
}

export interface NavBarAdPopoverItem {
  type: 'ad-popover'
  label: string
  adPlacement: string
  icon?: React.ReactNode
  gradientText?: boolean
  gradientTextColor?: string
  excludeLocales?: SupportedLocales[]
}

export type NavBarItem = NavBarLinkItem | NavBarAdPopoverItem

export interface NavBarConfig {
  links: NavBarItem[]
}
