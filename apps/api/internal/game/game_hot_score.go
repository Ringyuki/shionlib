package game

type HotScoreWeights struct {
	HalfLifeReleaseDays float64
	HalfLifeCreatedDays float64
	Views               float64
	Downloads           float64
	Release             float64
	Created             float64
	RecentWindowDays    float64
	RecentViews         float64
	RecentDownloads     float64
}
