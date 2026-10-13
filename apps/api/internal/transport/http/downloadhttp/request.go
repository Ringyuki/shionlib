package downloadhttp

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type downloadGamePathInput struct {
	ID int `path:"id" minimum:"1"`
}

type downloadResourcePathInput struct {
	ID int `path:"id" minimum:"1"`
}

func (b *downloadSourceBodyInput) Resolve(huma.Context) []error {
	return requireSimulator(b.Platform, b.Simulator)
}

func (b *editDownloadSourceBodyInput) Resolve(huma.Context) []error {
	return requireSimulator(b.Platform, b.Simulator)
}

func requireSimulator(platforms []string, simulator *string) []error {
	if download.NeedsSimulator(platforms) && (simulator == nil || *simulator == "") {
		return []error{&huma.ErrorDetail{Location: "body", Message: "expected required property simulator to be present"}}
	}
	return nil
}

type fileHistoryPathInput struct {
	FileID int `path:"fileId" minimum:"1"`
}

type downloadLinkInput struct {
	ID    int    `path:"id" minimum:"1"`
	Token string `query:"token" doc:"Token the visitor got from Cap for solving its challenge; it is spent by this request"`
}

type downloadFileUploadInput struct {
	UploadSessionID int    `json:"upload_session_id" minimum:"1"`
	FileName        string `json:"file_name,omitempty" maxLength:"255" doc:"Shown name; defaults to the uploaded file's name"`
}

func fileUploads(in []downloadFileUploadInput) []download.FileUpload {
	files := make([]download.FileUpload, len(in))
	for i, file := range in {
		files[i] = download.FileUpload{UploadSessionID: file.UploadSessionID, Name: file.FileName}
	}
	return files
}

type downloadSourceBodyInput struct {
	Platform     []string                  `json:"platform" minItems:"1" enum:"win,mac,ios,and,lin,ps3,ps4,psv,psp,swi,dvd"`
	Language     []string                  `json:"language" minItems:"1" enum:"en,zh,zh-hant,jp"`
	Simulator    *string                   `json:"simulator,omitempty" enum:"KRKR,ONS,ARTEMIS,OTHER"`
	Note         *string                   `json:"note,omitempty" maxLength:"255"`
	Translation  *string                   `json:"translation,omitempty" enum:"none,official,group,machine" doc:"Where the text in a language other than Japanese comes from; required when the languages include one"`
	Translators  []string                  `json:"translators,omitempty" maxItems:"6" doc:"Names of the translators credited when the translation is by a group; a name that is not known yet creates the translator"`
	PatchVersion *string                   `json:"patch_version,omitempty" minLength:"0" maxLength:"32"`
	ReleaseURL   *string                   `json:"release_url,omitempty" minLength:"0" maxLength:"512" doc:"The page the translation was released on"`
	Edition      *string                   `json:"edition,omitempty" enum:"download,package,steam"`
	EditionName  *string                   `json:"edition_name,omitempty" minLength:"0" maxLength:"64" doc:"The name of the edition, such as 初回限定版"`
	Form         string                    `json:"form" enum:"disc,installer,portable" doc:"How the game is packed: a disc image, an installer, or a folder that runs as it is"`
	Extras       []string                  `json:"extras,omitempty" maxItems:"2" enum:"save,bonus"`
	Files        []downloadFileUploadInput `json:"files" minItems:"1" maxItems:"1000" doc:"Completed upload sessions to attach, one per file"`
}

func (b *downloadSourceBodyInput) info() download.InfoInput {
	form := download.Form(b.Form)
	return download.InfoInput{
		Translation: (*download.Translation)(b.Translation), Translators: b.Translators, PatchVersion: b.PatchVersion, ReleaseURL: b.ReleaseURL,
		Edition: (*download.Edition)(b.Edition), EditionName: b.EditionName, Form: &form, Extras: b.Extras,
	}
}

type createDownloadSourceInput struct {
	ID   int `path:"id" minimum:"1"`
	Body downloadSourceBodyInput
}

type addDownloadFilesInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Files []downloadFileUploadInput `json:"files" minItems:"1" maxItems:"1000"`
	}
}

type downloadFilePathInput struct {
	FileID int `path:"fileId" minimum:"1"`
}

type renameDownloadFileInput struct {
	FileID int `path:"fileId" minimum:"1"`
	Body   struct {
		FileName string `json:"file_name" minLength:"1" maxLength:"255"`
	}
}

type editDownloadSourceBodyInput struct {
	Platform     []string `json:"platform" minItems:"1" enum:"win,mac,ios,and,lin,ps3,ps4,psv,psp,swi,dvd"`
	Language     []string `json:"language" minItems:"1" enum:"en,zh,zh-hant,jp"`
	Simulator    *string  `json:"simulator,omitempty" enum:"KRKR,ONS,ARTEMIS,OTHER"`
	Note         *string  `json:"note,omitempty" maxLength:"255"`
	Translation  *string  `json:"translation,omitempty" enum:"none,official,group,machine" doc:"Where the text in a language other than Japanese comes from; required when the languages include one"`
	Translators  []string `json:"translators,omitempty" maxItems:"6" doc:"Names of the translators credited when the translation is by a group; a name that is not known yet creates the translator"`
	PatchVersion *string  `json:"patch_version,omitempty" minLength:"0" maxLength:"32"`
	ReleaseURL   *string  `json:"release_url,omitempty" minLength:"0" maxLength:"512" doc:"The page the translation was released on"`
	Edition      *string  `json:"edition,omitempty" enum:"download,package,steam"`
	EditionName  *string  `json:"edition_name,omitempty" minLength:"0" maxLength:"64" doc:"The name of the edition, such as 初回限定版"`
	Form         *string  `json:"form,omitempty" enum:"disc,installer,portable" doc:"Left out for a resource whose form is not known"`
	Extras       []string `json:"extras,omitempty" maxItems:"2" enum:"save,bonus"`
}

func (b *editDownloadSourceBodyInput) info() download.InfoInput {
	return download.InfoInput{
		Translation: (*download.Translation)(b.Translation), Translators: b.Translators, PatchVersion: b.PatchVersion, ReleaseURL: b.ReleaseURL,
		Edition: (*download.Edition)(b.Edition), EditionName: b.EditionName, Form: (*download.Form)(b.Form), Extras: b.Extras,
	}
}

type editDownloadSourceInput struct {
	ID   int `path:"id" minimum:"1"`
	Body editDownloadSourceBodyInput
}

type downloadMigrateResourceInput struct {
	GameID int `path:"gameId" minimum:"1"`
	Body   struct {
		Platform  []string `json:"platform" minItems:"1" enum:"win,mac,ios,and,lin,ps3,ps4,psv,psp,swi,dvd"`
		Language  []string `json:"language" minItems:"1" enum:"en,zh,zh-hant,jp"`
		Simulator *string  `json:"simulator,omitempty" enum:"KRKR,ONS,ARTEMIS,OTHER"`
		Note      *string  `json:"note,omitempty" maxLength:"255"`
	}
}

type downloadMigrateFileInput struct {
	DownloadSourceID int `path:"downloadSourceId" minimum:"1"`
	Body             struct {
		FileName        string `json:"file_name" minLength:"1"`
		FileSize        int64  `json:"file_size" minimum:"0"`
		FileHash        string `json:"file_hash" minLength:"1"`
		FileContentType string `json:"file_content_type" minLength:"1"`
		S3FileKey       string `json:"s3_file_key" minLength:"1"`
	}
}

type downloadReuploadInput struct {
	FileID int `path:"fileId" minimum:"1"`
	Body   struct {
		UploadSessionID int     `json:"upload_session_id"`
		Reason          *string `json:"reason,omitempty" maxLength:"500"`
	}
}

type downloadHistoryReasonInput struct {
	HistoryID int `path:"historyId" minimum:"1"`
	Body      struct {
		Reason *string `json:"reason,omitempty" maxLength:"500"`
	}
}

type releaseListInput struct {
	httpapi.PageQuery
}

type userResourcesInput struct {
	ID int `path:"id" minimum:"1"`
	httpapi.PageQuery
}

type ownResourcesInput struct {
	Scope     string `query:"scope" enum:"all,processing,published" default:"all" doc:"processing: not yet published, or with a file that is not stored or is under review; published: everything else"`
	Search    string `query:"q" maxLength:"100" doc:"Part of a game title, a game alias or a file name"`
	SortBy    string `query:"sort_by" enum:"updated,downloads" default:"updated"`
	SortOrder string `query:"sort_order" enum:"asc,desc" default:"desc"`
	httpapi.PageQuery
}

type objectDeleteInput struct {
	Key string `query:"key"`
}
