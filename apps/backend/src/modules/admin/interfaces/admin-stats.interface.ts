export interface StatsOverview {
  totalGames: number
  totalUsers: number
  totalDownloads: number
  totalViews: number
  totalCharacters: number
  totalDevelopers: number
  totalComments: number
  newGamesToday: number
  newUsersToday: number
}

export interface StatsTrend {
  date: string
  games: number
  users: number
  downloads: number
  views: number
}
