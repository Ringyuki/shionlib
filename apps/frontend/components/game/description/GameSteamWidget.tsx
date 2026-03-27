import { GameLink } from '@/interfaces/game/game.interface'
import { useLocale } from 'next-intl'

const STEAM_APPID_PATTERNS = [/store\.steampowered\.com\/app\/(\d+)/, /steamdb\.info\/app\/(\d+)/]

const extractSteamAppId = (links: GameLink[]): string | null => {
  for (const link of links) {
    for (const pattern of STEAM_APPID_PATTERNS) {
      const match = link.url.match(pattern)
      if (match?.[1]) return match[1]
    }
  }
  return null
}

interface GameSteamWidgetProps {
  link: GameLink[]
}

export const GameSteamWidget = ({ link }: GameSteamWidgetProps) => {
  const appId = extractSteamAppId(link)
  const locale = useLocale()
  if (!appId) return null
  const langMap = {
    en: 'english',
    ja: 'japanese',
    zh: 'schinese',
  } as const
  const lang = langMap[locale as keyof typeof langMap]

  return (
    <iframe
      title="Steam Store Widget"
      src={`/steamapp/${appId}?l=${lang}`}
      className="w-full rounded-md border-0"
      height={190}
      loading="lazy"
    />
  )
}
