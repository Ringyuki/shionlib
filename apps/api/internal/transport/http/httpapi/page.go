package httpapi

type PageQuery struct {
	Page     int `query:"page" default:"1" minimum:"1" doc:"1-based page number"`
	PageSize int `query:"pageSize" default:"10" minimum:"1" maximum:"50" doc:"Items per page"`
}
