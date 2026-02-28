import { ShionlibSiteConfig, NavBarConfig } from '@/interfaces/site/shion-lib-site-config.interface'
import { SparklesIcon } from 'lucide-react'
import { supportedLocalesEnum } from '../i18n/supported'

export const shionlibSiteConfig: ShionlibSiteConfig = {
  canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://shionlib.com',
  robots: {
    index: process.env.NEXT_PUBLIC_ROBOTS_INDEX !== 'false',
    follow: process.env.NEXT_PUBLIC_ROBOTS_FOLLOW !== 'false',
  },
}

export const navBarConfig: NavBarConfig = {
  links: [
    {
      label: 'games',
      href: '/game',
    },
    {
      label: 'producers',
      href: '/developer',
    },
    {
      label: 'create',
      href: '/create',
    },
    {
      label: 'releases',
      href: '/release',
    },
    {
      label: 'activities',
      href: '/activity',
    },
    {
      label: 'docs',
      href: '/docs',
    },
    {
      label: 'aiGirlFriend',
      href: 'https://s.himoe.uk/ycnbdn',
      external: true,
      icon: <SparklesIcon className="w-4 h-4" />,
      gradientText: true,
      excludeLocales: [supportedLocalesEnum.JA, supportedLocalesEnum.EN],
    },
  ],
}
