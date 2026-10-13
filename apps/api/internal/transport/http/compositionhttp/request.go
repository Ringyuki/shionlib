package compositionhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type compositionPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type compositionGameInput struct {
	GameID int `path:"gameId" minimum:"1"`
}

type compositionResourceInput struct {
	ResourceID int `path:"resourceId" minimum:"1"`
}

type beginCompositionInput struct {
	GameID int `path:"gameId" minimum:"1"`
	Body   struct {
		BaseResourceID int `json:"base_resource_id" minimum:"1" doc:"A published resource of the same game that runs as it is, taken from the list of bases"`
	}
}

type compositionUploadInput struct {
	UploadSessionID int    `json:"upload_session_id" minimum:"1" doc:"A completed upload of the caller that is not part of a resource"`
	FileName        string `json:"file_name" minLength:"1" maxLength:"255"`
}

func (b compositionUploadInput) upload() composition.Upload {
	return composition.Upload{SessionID: b.UploadSessionID, Name: b.FileName}
}

type attachCompositionInput struct {
	ID   int `path:"id" minimum:"1"`
	Body compositionUploadInput
}

type editCompositionInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Language     []string `json:"language" maxItems:"4" enum:"en,zh,zh-hant,jp" doc:"The languages of the composed resource"`
		Translation  *string  `json:"translation,omitempty" enum:"official,group,machine" doc:"Where the translation of the patch comes from"`
		Translators  []string `json:"translators" maxItems:"6"`
		PatchVersion *string  `json:"patch_version,omitempty" minLength:"0" maxLength:"32"`
		ReleaseURL   *string  `json:"release_url,omitempty" minLength:"0" maxLength:"512"`
		KeepPatch    bool     `json:"keep_patch" doc:"Whether the patch archive is put into the result beside the game"`
		GameDir      *string  `json:"game_dir,omitempty" maxLength:"1024" doc:"The folder of the base that receives the patch; empty for its root, left out to keep the one chosen before (the server's guess until one is chosen)"`
		PatchDir     *string  `json:"patch_dir,omitempty" maxLength:"1024" doc:"The folder of the patch whose files are laid over the game; empty for its root, left out to keep the one chosen before (the server's guess until one is chosen)"`
	}
}

func (in *editCompositionInput) changes() composition.Changes {
	body := in.Body
	languages, translators := body.Language, body.Translators
	if languages == nil {
		languages = []string{}
	}
	if translators == nil {
		translators = []string{}
	}
	translation := (*download.Translation)(body.Translation)
	changes := composition.Changes{
		Languages:    &languages,
		Translation:  &translation,
		Translators:  &translators,
		PatchVersion: &body.PatchVersion,
		ReleaseURL:   &body.ReleaseURL,
		KeepPatch:    &body.KeepPatch,
	}
	if body.GameDir != nil {
		changes.GameDir = &body.GameDir
	}
	if body.PatchDir != nil {
		changes.PatchDir = &body.PatchDir
	}
	return changes
}

type rebuildCompositionInput struct {
	ResourceID int `path:"resourceId" minimum:"1"`
	Body       struct {
		UploadSessionID int     `json:"upload_session_id" minimum:"1"`
		FileName        string  `json:"file_name" minLength:"1" maxLength:"255"`
		PatchVersion    *string `json:"patch_version,omitempty" minLength:"0" maxLength:"32"`
		Note            *string `json:"note,omitempty" minLength:"0" maxLength:"255" doc:"What the new patch changes; shown in the history of the resource"`
	}
}
