const almostDone = 99

export function percentSent(sent: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return Math.min(almostDone, Math.max(0, Math.floor((sent / total) * 100)))
}
