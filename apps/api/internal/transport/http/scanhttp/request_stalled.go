package scanhttp

type stalledCheckPathInput struct {
	FileID int `path:"file_id" minimum:"1"`
}
