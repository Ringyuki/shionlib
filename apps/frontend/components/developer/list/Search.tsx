'use client'

import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation.client'
import { Search as SearchIcon } from 'lucide-react'
import { useDebounce } from 'react-use'
import { useState, useEffect, useRef } from 'react'

interface SearchProps {
  initialQ: string
}

export const Search = ({ initialQ }: SearchProps) => {
  const t = useTranslations('Components.Developer.List.Search')
  const [q, setQ] = useState<string>(initialQ)
  const router = useRouter()
  const init = useRef(true)

  const handleSearch = () => {
    if (init.current) return
    if (q !== undefined) {
      router.push(`/developer?q=${q}`)
      return
    }
  }
  useEffect(() => {
    setTimeout(() => {
      init.current = false
    }, 1000)
  }, [])
  useDebounce(() => handleSearch(), 500, [q])
  return (
    <Input
      value={q}
      onChange={e => setQ(e.target.value)}
      size="lg"
      className="hover:bg-input/20 transition-colors duration-200"
      placeholder={t('placeholder')}
      prefix={<SearchIcon className="w-4 h-4" />}
    />
  )
}
