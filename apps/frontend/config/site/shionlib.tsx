import { ShionlibSiteConfig, NavBarConfig } from '@/interfaces/site/shion-lib-site-config.interface'
import { SparklesIcon } from 'lucide-react'

export const shionlibSiteConfig: ShionlibSiteConfig = {
  canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://shionlib.com',
  robots: {
    index: process.env.NEXT_PUBLIC_ROBOTS_INDEX === 'true',
    follow: process.env.NEXT_PUBLIC_ROBOTS_FOLLOW === 'true',
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
      label: 'docs',
      href: '/docs',
    },
    {
      label: 'aiGirlFriend',
      href: 'https://s.himoe.uk/ycnbdn',
      external: true,
      icon: <SparklesIcon className="w-4 h-4" />,
      gradientText: true,
    },
  ],
}
