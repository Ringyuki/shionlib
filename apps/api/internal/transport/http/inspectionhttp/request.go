package inspectionhttp

type resourceInspectionsInput struct {
	ResourceID int `path:"resource_id" minimum:"1"`
}

type inspectionEntriesInput struct {
	ID       int `path:"id" minimum:"1"`
	ParentID int `query:"parent_id" minimum:"0" doc:"The folder, archive or disc image whose entries are listed; left out for the top level"`
	Page     int `query:"page" default:"1" minimum:"1" doc:"1-based page number"`
	PageSize int `query:"pageSize" default:"200" minimum:"1" maximum:"200" doc:"Items per page"`
}

type inspectionSearchInput struct {
	ID       int    `path:"id" minimum:"1"`
	Query    string `query:"q" required:"true" minLength:"1" maxLength:"100" doc:"Part of a file name, matched without regard to case"`
	Page     int    `query:"page" default:"1" minimum:"1" doc:"1-based page number"`
	PageSize int    `query:"pageSize" default:"200" minimum:"1" maximum:"200" doc:"Items per page"`
}

type inspectionEntryInput struct {
	EntryID int `path:"entry_id" minimum:"1"`
}
