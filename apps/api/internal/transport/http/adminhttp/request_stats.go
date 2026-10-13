package adminhttp

type adminStatsTrendsInput struct {
	Days int `query:"days" default:"30" minimum:"1" maximum:"90" doc:"Number of days ending today (UTC+8)"`
}
