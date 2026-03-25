export class SponsorWallItemResDto {
  id: number
  sponsorName: string | null
  user: {
    id: number
    name: string
    avatar: string
  } | null
  message: string | null
  amount: number
  paidAt: Date
}
