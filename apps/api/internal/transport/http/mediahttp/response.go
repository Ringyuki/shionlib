package mediahttp

type UploadedImageDTO struct {
	Key string `json:"key"`
}

type UploadedPictureDTO struct {
	Key    string `json:"key" doc:"What an image_block node takes as src"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}
