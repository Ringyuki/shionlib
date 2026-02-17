import { Platform } from '@/interfaces/game/game.interface'

export const PlatformMap: Record<string, Partial<Platform>> = {
  windows: 'win',
  macos: 'mac',
  linux: 'lin',
  ios: 'ios',
  android: 'and',
  other: 'other',
}
