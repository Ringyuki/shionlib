import { GameCharacterRole } from '@/interfaces/game/game.interface'

export const roleBadgeColorMap: { [key in GameCharacterRole]: string } = {
  main: 'bg-warning text-warning-foreground border-warning-foreground',
  primary: 'bg-primary text-primary-foreground',
  side: 'bg-accent text-accent-foreground border-accent-foreground',
  appears: 'bg-secondary text-secondary-foreground border-secondary-foreground',
} as const
