import {
  Bell,
  Bookmark,
  Building2,
  CalendarDays,
  Gamepad2,
  House,
  Settings,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react'
import type { NavKey } from '../shell'

export const navIcons: Record<NavKey, LucideIcon> = {
  home: House,
  games: Gamepad2,
  releases: CalendarDays,
  developers: Building2,
  favorites: Bookmark,
  uploads: UploadCloud,
  messages: Bell,
  settings: Settings,
}
