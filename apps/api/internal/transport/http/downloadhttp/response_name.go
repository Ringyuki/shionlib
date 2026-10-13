package downloadhttp

import "github.com/Ringyuki/shionlib/apps/api/internal/download"

type fileNameDTO struct {
	Before  string `json:"before" doc:"The name up to the disc format; the whole name without its extension when nothing is pending"`
	After   string `json:"after" doc:"What follows: the extension, preceded by the closing bracket of a pending disc format"`
	Pending bool   `json:"pending" doc:"True for a disc image whose format is not known until the file has been checked; the format goes between before and after"`
}

type fileNameReadingDTO struct {
	Translation  *download.Translation `json:"translation" enum:"none,official,group,machine"`
	Translators  []string              `json:"translators"`
	PatchVersion *string               `json:"patch_version"`
	Edition      *download.Edition     `json:"edition" enum:"download,package,steam"`
	EditionName  *string               `json:"edition_name"`
	Form         *download.Form        `json:"form" enum:"disc,installer,portable"`
}

func toFileNameReadingDTO(read download.FileNameReading) fileNameReadingDTO {
	return fileNameReadingDTO{
		Translation: read.Translation, Translators: read.Translators, PatchVersion: read.PatchVersion,
		Edition: read.Edition, EditionName: read.EditionName, Form: read.Form,
	}
}
