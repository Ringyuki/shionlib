package downloadhttp

import "github.com/Ringyuki/shionlib/apps/api/internal/download"

type previewNameInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		ResourceID   *int     `json:"resource_id,omitempty" minimum:"1" doc:"A resource of the game whose first file is named; left out for an upload that has not been made yet"`
		FileName     string   `json:"file_name,omitempty" maxLength:"255" doc:"The name of the file being uploaded, which gives the extension and, for an old name, the disc format"`
		Language     []string `json:"language" minItems:"1" enum:"en,zh,zh-hant,jp"`
		Translation  *string  `json:"translation,omitempty" enum:"none,official,group,machine"`
		Translators  []string `json:"translators,omitempty" maxItems:"6"`
		PatchVersion *string  `json:"patch_version,omitempty" minLength:"0" maxLength:"32"`
		Edition      *string  `json:"edition,omitempty" enum:"download,package,steam"`
		EditionName  *string  `json:"edition_name,omitempty" minLength:"0" maxLength:"64"`
		Form         *string  `json:"form,omitempty" enum:"disc,installer,portable"`
	}
}

func (in *previewNameInput) preview() download.NamePreview {
	body := in.Body
	return download.NamePreview{
		GameID:     in.ID,
		ResourceID: body.ResourceID,
		Languages:  body.Language,
		Uploaded:   body.FileName,
		Info: download.InfoInput{
			Translation: (*download.Translation)(body.Translation), Translators: body.Translators, PatchVersion: body.PatchVersion,
			Edition: (*download.Edition)(body.Edition), EditionName: body.EditionName, Form: (*download.Form)(body.Form),
		},
	}
}

type readNameInput struct {
	Body struct {
		FileName string `json:"file_name" minLength:"1" maxLength:"255"`
	}
}
