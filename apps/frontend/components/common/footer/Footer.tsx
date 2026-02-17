import { SiteLogo } from '@/components/common/top-bar/SiteLogo'
import Link from 'next/link'
import { Link as I18nLink } from '@/i18n/navigation'
import { Copyright, Github, MessageCircle } from 'lucide-react'
import { RiTelegram2Fill } from 'react-icons/ri'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Separator } from '@/components/shionui/Separator'

export const ShionlibFooter = async () => {
  const t = await getTranslations('Components.Common.Footer.ShionlibFooter')
  return (
    <div className="mx-auto w-full py-6 px-3 max-w-7xl">
      <div className="flex md:flex-row flex-col gap-4 md:gap-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/favicon.ico" alt="Shionlib Logo" width={32} height={32} className="size-8" />
          <div className="flex items-center gap-1">
            <Copyright className="size-3" />
            <span className="text-xs text-foreground">2025</span>
          </div>
          <SiteLogo size={16} className="text-sm pt-0.5 text-card-foreground" />
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-6 text-sm">
            <I18nLink
              href="/friend-link"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              {t('friendLink')}
            </I18nLink>
          </div>
          <Separator orientation="vertical" className="h-4! bg-foreground hidden md:block" />
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="https://github.com/Ringyuki/shionlib-frontend"
              target="_blank"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <Github className="size-3" />
              GitHub
            </Link>
            <Link
              href="https://t.me/shionlib"
              target="_blank"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <RiTelegram2Fill className="size-3" />
              Telegram
            </Link>
            <Link
              href="mailto:admin@shionlib.com"
              target="_blank"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <MessageCircle className="size-3" />
              {t('contact')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
