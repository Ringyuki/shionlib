package adminhttp

type adminStatsOverviewDTO struct {
	TotalGames      int   `json:"totalGames"`
	TotalUsers      int   `json:"totalUsers"`
	TotalDownloads  int64 `json:"totalDownloads"`
	TotalViews      int64 `json:"totalViews"`
	TotalCharacters int   `json:"totalCharacters"`
	TotalDevelopers int   `json:"totalDevelopers"`
	TotalComments   int   `json:"totalComments"`
	NewGamesToday   int   `json:"newGamesToday"`
	NewUsersToday   int   `json:"newUsersToday"`
}

type adminStatsTrendDTO struct {
	Date      string `json:"date" doc:"YYYY-MM-DD in UTC+8"`
	Games     int    `json:"games"`
	Users     int    `json:"users"`
	Downloads int    `json:"downloads" doc:"Always 0; daily downloads are not tracked"`
	Views     int    `json:"views" doc:"Always 0; daily views are not tracked"`
}
