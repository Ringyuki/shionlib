export interface SearchHistory {
  id: number
  query: string
  created_at: string
}

export interface SearchTrending {
  trending: SearchTrendingItem[]
  updated_at: string
}

export interface SearchTrendingItem {
  score: number
  query: string
}

export interface SearchSuggestItem {
  query: string
  score: number
}
