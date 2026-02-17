import { GameCharacterRole } from '@/interfaces/game/game.interface'

export const roleBadgeColorMap: { [key in GameCharacterRole]: string } = {
  main: 'bg-warning',
  primary: 'bg-primary',
  side: 'bg-accent text-accent-foreground',
  appears: 'bg-secondary text-secondary-foreground',
} as const
