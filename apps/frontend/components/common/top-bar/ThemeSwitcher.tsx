'use client'

import { Button } from '@/components/shionui/Button'
import { Moon, Sun, SunMoon, Palette } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/shionui/DropdownMenu'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useState } from 'react'

export default function ThemeSwitcher() {
  const t = useTranslations('Components.Common.TopBar.ThemeSwitcher')
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const currentValue = useMemo(() => {
    if (!mounted) return 'system'
    if (theme === 'system') return 'system'
    return (resolvedTheme ?? 'light') as 'light' | 'dark'
  }, [mounted, theme, resolvedTheme])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          appearance="ghost"
          intent="secondary"
          size="icon"
          renderIcon={<Palette className="size-4.5" />}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="text-sm font-medium">{t('label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentValue} onValueChange={value => setTheme(value)}>
          <DropdownMenuRadioItem
            value="system"
            className="cursor-pointer h-10 transition-all duration-300"
          >
            <SunMoon />
            <DropdownMenuShortcut>{t('system')}</DropdownMenuShortcut>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="cursor-pointer h-10 transition-all duration-300"
          >
            <Moon />
            <DropdownMenuShortcut>{t('dark')}</DropdownMenuShortcut>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="light"
            className="cursor-pointer h-10 transition-all duration-300"
          >
            <Sun />
            <DropdownMenuShortcut>{t('light')}</DropdownMenuShortcut>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
