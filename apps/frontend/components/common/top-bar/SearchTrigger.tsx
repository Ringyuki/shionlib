import { Kbd } from '@/components/shionui/Kbd'
import { SearchIcon } from 'lucide-react'
import { useSearchStore } from '@/store/searchStore'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { isIOS, isMacOs } from 'react-device-detect'
import { Button } from '@/components/shionui/Button'

export const SearchTrigger = () => {
  const { openSearchDialog } = useSearchStore()
  const t = useTranslations('Components.Common.TopBar.SearchTrigger')

  const [isApple, setIsApple] = useState(false)
  useEffect(() => {
    setIsApple(isMacOs || isIOS)
  }, [])
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        openSearchDialog()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [openSearchDialog])

  return (
    <>
      <div
        className="bg-secondary rounded-md p-2 hidden search-trigger:flex items-center justify-between gap-1 lg:gap-12 select-none cursor-pointer hover:opacity-70 transition-opacity ease-in-out"
        onClick={openSearchDialog}
      >
        <div className="flex items-center gap-2">
          <SearchIcon className="size-4" />
          <span className="text-sm font-medium text-foreground/70">{t('search')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Kbd className="text-sm font-medium bg-white border">{isApple ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd className="text-xs font-medium bg-white border">K</Kbd>
        </div>
      </div>
      <div className="block search-trigger:hidden">
        <Button
          appearance="ghost"
          intent="secondary"
          size="icon"
          onClick={openSearchDialog}
          renderIcon={<SearchIcon className="size-4.5" />}
        />
      </div>
    </>
  )
}
