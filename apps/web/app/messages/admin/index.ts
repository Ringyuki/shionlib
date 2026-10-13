import type { AdminMessages } from './zh'

export async function loadAdminMessages(): Promise<AdminMessages> {
  return (await import('./zh')).adminMessages
}

export type { AdminMessages }
