import {
  Bell,
  Bookmark,
  Building2,
  CalendarDays,
  Gamepad2,
  History,
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
  activity: History,
  favorites: Bookmark,
  uploads: UploadCloud,
  messages: Bell,
  settings: Settings,
}
