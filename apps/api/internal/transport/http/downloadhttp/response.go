package downloadhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type downloadLinkDTO struct {
	FileURL   string `json:"file_url"`
	ExpiresIn int64  `json:"expires_in"`
}

type downloadMalwareCaseDTO struct {
	ID              int      `json:"id"`
	DetectedViruses []string `json:"detected_viruses"`
}

type downloadHistoryRefDTO struct {
	ID         int       `json:"id"`
	Reason     *string   `json:"reason"`
	Created    time.Time `json:"created"`
	OperatorID int       `json:"operator_id"`
}

type downloadFileDTO struct {
	ID                   int                      `json:"id"`
	Type                 int                      `json:"type"`
	FileName             string                   `json:"file_name"`
	FileSize             int64                    `json:"file_size"`
	FileURL              *string                  `json:"file_url"`
	S3FileKey            *string                  `json:"s3_file_key"`
	HashAlgorithm        upload.HashAlgorithm     `json:"hash_algorithm" enum:"sha256,blake3"`
	FileHash             string                   `json:"file_hash"`
	FileStatus           int                      `json:"file_status"`
	Stage                download.Stage           `json:"stage" enum:"checking,awaiting_volumes,storing,stored,under_review,stalled,rejected" doc:"Where the file is on its way to being downloadable: checking (waiting for or under its check), awaiting_volumes (a volume of a set that lacks the volumes named in missing_volumes; checked once they are added), storing (passed, moving to object storage), stored, under_review (held for a malware review), stalled (its check kept failing and waits for an operator) or rejected (about to be removed)"`
	Rejection            *download.Rejection      `json:"rejection" enum:"truncated,unsupported,encrypted,harmful,incomplete_set,abandoned" doc:"Why a rejected file was rejected (abandoned: its check could never be completed); null otherwise"`
	IsVirusFalsePositive bool                     `json:"is_virus_false_positive"`
	MalwareScanCases     []downloadMalwareCaseDTO `json:"malware_scan_cases"`
	Creator              userhttp.UserSummaryDTO  `json:"creator"`
	LatestHistory        *downloadHistoryRefDTO   `json:"latest_history"`
	Uploaded             time.Time                `json:"uploaded" doc:"When the content the file holds now was uploaded: its latest replacement, or its first upload"`
	SHA256               *string                  `json:"sha256" doc:"SHA-256 of the file, computed while it is checked; null until then"`
	InspectionID         *int                     `json:"inspection_id" doc:"The record of what the check found in the file; volumes of one archive share it. Null until the file has been read"`
}

type downloadTranslatorDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type downloadResourceDTO struct {
	ID              int                     `json:"id"`
	Platform        []string                `json:"platform"`
	Language        []string                `json:"language"`
	Simulator       *string                 `json:"simulator"`
	Note            *string                 `json:"note"`
	Translation     *download.Translation   `json:"translation" enum:"none,official,group,machine" doc:"Where the text in a language other than Japanese comes from; null when nobody has said"`
	Translators     []downloadTranslatorDTO `json:"translators" doc:"The translators credited, in the order they were given; empty unless the translation is by a group"`
	PatchVersion    *string                 `json:"patch_version"`
	ReleaseURL      *string                 `json:"release_url" doc:"The page the translation was released on"`
	Edition         *download.Edition       `json:"edition" enum:"download,package,steam"`
	EditionName     *string                 `json:"edition_name"`
	Form            *download.Form          `json:"form" enum:"disc,installer,portable" doc:"How the game is packed; null when nobody has said"`
	Extras          []string                `json:"extras" enum:"save,bonus"`
	Downloads       int                     `json:"downloads"`
	Creator         userhttp.UserSummaryDTO `json:"creator"`
	PublishedAt     *time.Time              `json:"published_at" doc:"Null while the resource is still being checked; only its uploader sees it then"`
	Created         time.Time               `json:"created"`
	Updated         time.Time               `json:"updated"`
	Comments        int                     `json:"comments" doc:"Visible comments made on the resource, replies included"`
	Files           []downloadFileDTO       `json:"files" doc:"The files in the order they are read: the volumes of a set together and in their own order, sets and single files by the first of their files that was added"`
	MissingVolumes  []string                `json:"missing_volumes" doc:"File names of the volumes that the sets still waiting for their check lack, as their siblings are named; empty when nothing is missing"`
	VolumesDeadline *time.Time              `json:"volumes_deadline" doc:"When the files waiting for those volumes are removed if their set is still incomplete; null when nothing is missing"`
}

type downloadResourceDetailDTO struct {
	Resource downloadResourceDTO  `json:"resource"`
	Game     gamehttp.GameCardDTO `json:"game"`
}

type downloadEventFileDTO struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

type downloadEventChangeDTO struct {
	Field download.EventField `json:"field" enum:"platforms,languages,simulator,note,translation,translators,patch_version,release_url,edition,edition_name,form,extras"`
	Old   []string            `json:"old" doc:"Values before the edit; empty when the field was unset"`
	New   []string            `json:"new" doc:"Values after the edit; empty when the field was cleared"`
}

type downloadEventDTO struct {
	ID      int                      `json:"id"`
	Kind    download.EventKind       `json:"kind" enum:"published,file_replaced,file_renamed,file_added,file_removed,edited,review_cleared,disc_found" doc:"What happened: the resource was published, a file was replaced, renamed, added or removed, the resource's fields were edited, an admin cleared a file flagged by the malware scan, or the check found a disc image and set the form to disc"`
	Actor   *userhttp.UserSummaryDTO `json:"actor" doc:"Who did it; null when the account no longer exists"`
	Created time.Time                `json:"created"`
	Files   []downloadEventFileDTO   `json:"files" doc:"Files the resource was published with, or the file added or removed"`
	Name    *string                  `json:"name" doc:"The file replaced or cleared, or the new name of a renamed file"`
	OldName *string                  `json:"old_name" doc:"Name of a renamed file before the change"`
	Reason  *string                  `json:"reason" doc:"Reason given for replacing a file"`
	OldSize *int64                   `json:"old_size" doc:"Size of a replaced file before the change"`
	NewSize *int64                   `json:"new_size" doc:"Size of a replaced file after the change"`
	Changes []downloadEventChangeDTO `json:"changes" doc:"Fields changed by an edit"`
}

func toEventDTO(event download.Event, now time.Time) downloadEventDTO {
	out := downloadEventDTO{
		ID:      event.ID,
		Kind:    event.Kind,
		Created: event.Created,
		Files:   make([]downloadEventFileDTO, len(event.Data.Files)),
		Reason:  event.Data.Reason,
		OldSize: event.Data.OldSize,
		NewSize: event.Data.NewSize,
		Changes: make([]downloadEventChangeDTO, len(event.Data.Changes)),
	}
	if event.Actor != nil {
		actor := userhttp.ToUserSummary(*event.Actor, now)
		out.Actor = &actor
	}
	if event.Data.Name != "" {
		out.Name = &event.Data.Name
	}
	if event.Data.OldName != "" {
		out.OldName = &event.Data.OldName
	}
	for i, file := range event.Data.Files {
		out.Files[i] = downloadEventFileDTO{Name: file.Name, Size: file.Size}
	}
	for i, change := range event.Data.Changes {
		out.Changes[i] = downloadEventChangeDTO{Field: change.Field, Old: nonNil(change.Old), New: nonNil(change.New)}
	}
	return out
}

type downloadOwnSummaryDTO struct {
	Processing int `json:"processing" doc:"Resources not yet published, or with a file that is not stored or is under review"`
	Published  int `json:"published" doc:"Every other resource of the caller"`
	Downloads  int `json:"downloads" doc:"Downloads across the caller's resources"`
	Games      int `json:"games" doc:"Games the caller's resources belong to"`
	Files      int `json:"files" doc:"Files in the caller's resources"`
	Recent     int `json:"recent" doc:"Resources the caller created within the last recent_days days"`
	RecentDays int `json:"recent_days" doc:"Length in days of the window recent counts"`
}

func toOwnSummary(summary download.OwnSummary) downloadOwnSummaryDTO {
	return downloadOwnSummaryDTO{
		Processing: summary.Processing,
		Published:  summary.Published,
		Downloads:  summary.Downloads,
		Games:      summary.Games,
		Files:      summary.Files,
		Recent:     summary.Recent,
		RecentDays: int(download.OwnRecentWindow / (24 * time.Hour)),
	}
}

type downloadOwnResourceDTO struct {
	Resource downloadResourceDTO  `json:"resource"`
	Game     gamehttp.GameCardDTO `json:"game"`
}

type downloadResourceCreatedDTO struct {
	ID int `json:"id"`
}

type downloadReleaseDTO struct {
	ID          int                     `json:"id"`
	Platform    []string                `json:"platform"`
	Language    []string                `json:"language"`
	Note        *string                 `json:"note"`
	Downloads   int                     `json:"downloads"`
	Game        gamehttp.GameCardDTO    `json:"game"`
	Files       []string                `json:"files"`
	FilesCount  int                     `json:"files_count"`
	Creator     userhttp.UserSummaryDTO `json:"creator"`
	PublishedAt *time.Time              `json:"published_at"`
	Created     time.Time               `json:"created"`
}

type downloadReleaseMetaDTO struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type downloadReleasePageDTO struct {
	Items []downloadReleaseDTO   `json:"items"`
	Meta  downloadReleaseMetaDTO `json:"meta"`
}

type downloadUserResourceDTO struct {
	ID              int                     `json:"id"`
	Platform        []string                `json:"platform"`
	Language        []string                `json:"language"`
	Note            *string                 `json:"note"`
	Downloads       int                     `json:"downloads"`
	FileName        string                  `json:"file_name"`
	MoreThanOneFile bool                    `json:"more_than_one_file"`
	FilesCount      int                     `json:"files_count"`
	Game            gamehttp.GameCardDTO    `json:"game"`
	Creator         userhttp.UserSummaryDTO `json:"creator"`
	PublishedAt     *time.Time              `json:"published_at"`
	Created         time.Time               `json:"created"`
	Updated         time.Time               `json:"updated"`
}

type downloadUserResourceMetaDTO struct {
	response.PageMeta
	IsCurrentUser     bool `json:"is_current_user"`
	HasOnGoingSession bool `json:"has_on_going_session"`
	ContentLimit      int  `json:"content_limit"`
}

type downloadUserResourcePageDTO struct {
	Items []downloadUserResourceDTO   `json:"items"`
	Meta  downloadUserResourceMetaDTO `json:"meta"`
}

type downloadReuploadDTO struct {
	OK bool `json:"ok"`
}

type downloadHistoryDTO struct {
	ID            int                     `json:"id"`
	FileSize      int64                   `json:"file_size"`
	HashAlgorithm upload.HashAlgorithm    `json:"hash_algorithm" enum:"sha256,blake3"`
	FileHash      string                  `json:"file_hash"`
	S3FileKey     *string                 `json:"s3_file_key"`
	Reason        *string                 `json:"reason"`
	Operator      userhttp.UserSummaryDTO `json:"operator"`
	Created       time.Time               `json:"created"`
}

type storageObjectDTO struct {
	Key          string     `json:"Key"`
	LastModified *time.Time `json:"LastModified,omitempty"`
	ETag         string     `json:"ETag,omitempty"`
	Size         int64      `json:"Size"`
	StorageClass string     `json:"StorageClass,omitempty"`
}

type storageListingDTO struct {
	Contents              []storageObjectDTO `json:"Contents"`
	IsTruncated           bool               `json:"IsTruncated"`
	KeyCount              int                `json:"KeyCount"`
	MaxKeys               int                `json:"MaxKeys"`
	Name                  string             `json:"Name"`
	Prefix                string             `json:"Prefix"`
	ContinuationToken     string             `json:"ContinuationToken,omitempty"`
	NextContinuationToken string             `json:"NextContinuationToken,omitempty"`
}

func toResourceDTO(r download.GameResource, now time.Time) downloadResourceDTO {
	out := downloadResourceDTO{
		ID:             r.ID,
		Platform:       nonNil(r.Platforms),
		Language:       nonNil(r.Languages),
		Simulator:      r.Simulator,
		Note:           r.Note,
		Translation:    r.Info.Translation,
		Translators:    make([]downloadTranslatorDTO, len(r.Info.Translators)),
		PatchVersion:   r.Info.PatchVersion,
		ReleaseURL:     r.Info.ReleaseURL,
		Edition:        r.Info.Edition,
		EditionName:    r.Info.EditionName,
		Form:           r.Info.Form,
		Extras:         nonNil(r.Info.Extras),
		Downloads:      r.Downloads,
		Creator:        userhttp.ToUserSummary(r.Creator, now),
		PublishedAt:    r.PublishedAt,
		Created:        r.Created,
		Updated:        r.Updated,
		Comments:       r.Comments,
		Files:          make([]downloadFileDTO, len(r.Files)),
		MissingVolumes: []string{},
	}
	for i, credited := range r.Info.Translators {
		out.Translators[i] = downloadTranslatorDTO(credited)
	}
	if r.Awaited != nil {
		out.MissingVolumes, out.VolumesDeadline = r.Awaited.Names, &r.Awaited.Deadline
	}
	for i, file := range r.Files {
		cases := make([]downloadMalwareCaseDTO, len(file.MalwareCases))
		for j, scanCase := range file.MalwareCases {
			cases[j] = downloadMalwareCaseDTO{ID: scanCase.ID, DetectedViruses: nonNil(scanCase.Viruses)}
		}
		dto := downloadFileDTO{
			ID:                   file.ID,
			Type:                 file.Type,
			FileName:             file.Name,
			FileSize:             file.Size,
			FileURL:              file.URL,
			S3FileKey:            file.StorageKey,
			HashAlgorithm:        file.HashAlgorithm,
			FileHash:             file.Hash,
			FileStatus:           file.Status,
			Stage:                r.StageOf(file),
			IsVirusFalsePositive: file.FalsePositive,
			MalwareScanCases:     cases,
			Creator:              userhttp.ToUserSummary(file.Creator, now),
			Uploaded:             file.Uploaded(),
			SHA256:               file.SHA256,
			InspectionID:         file.InspectionID,
		}
		if rejection, rejected := file.CheckStatus.Rejection(); rejected && dto.Stage == download.StageRejected {
			dto.Rejection = &rejection
		}
		if latest := file.LatestReupload(); latest != nil {
			dto.LatestHistory = &downloadHistoryRefDTO{ID: latest.ID, Reason: latest.Reason, Created: latest.Created, OperatorID: latest.OperatorID}
		}
		out.Files[i] = dto
	}
	return out
}

func toReleaseDTO(r download.Release, now time.Time) downloadReleaseDTO {
	return downloadReleaseDTO{
		ID:          r.ID,
		Platform:    nonNil(r.Platforms),
		Language:    nonNil(r.Languages),
		Note:        r.Note,
		Downloads:   r.Downloads,
		Game:        gamehttp.ToGameCard(r.Game),
		Files:       nonNil(r.FileNames),
		FilesCount:  r.FilesCount,
		Creator:     userhttp.ToUserSummary(r.Creator, now),
		PublishedAt: r.PublishedAt,
		Created:     r.Created,
	}
}

func toUserResourceDTO(r download.UserResource, now time.Time) downloadUserResourceDTO {
	out := downloadUserResourceDTO{
		ID:              r.ID,
		Platform:        nonNil(r.Platforms),
		Language:        nonNil(r.Languages),
		Note:            r.Note,
		Downloads:       r.Downloads,
		MoreThanOneFile: r.FilesCount > 1,
		FilesCount:      r.FilesCount,
		Game:            gamehttp.ToGameCard(r.Game),
		Creator:         userhttp.ToUserSummary(r.Creator, now),
		PublishedAt:     r.PublishedAt,
		Created:         r.Created,
		Updated:         r.Updated,
	}
	if len(r.FileNames) > 0 {
		out.FileName = r.FileNames[0]
	}
	return out
}

func toHistoryDTO(h download.HistoryEntry, now time.Time) downloadHistoryDTO {
	return downloadHistoryDTO{
		ID:            h.ID,
		FileSize:      h.Size,
		HashAlgorithm: h.HashAlgorithm,
		FileHash:      h.Hash,
		S3FileKey:     h.StorageKey,
		Reason:        h.Reason,
		Operator:      userhttp.ToUserSummary(h.Operator, now),
		Created:       h.Created,
	}
}

func toListingDTO(l download.Listing) storageListingDTO {
	out := storageListingDTO{
		Contents:              make([]storageObjectDTO, len(l.Objects)),
		IsTruncated:           l.IsTruncated,
		KeyCount:              l.KeyCount,
		MaxKeys:               l.MaxKeys,
		Name:                  l.Name,
		Prefix:                l.Prefix,
		ContinuationToken:     l.ContinuationToken,
		NextContinuationToken: l.NextContinuationToken,
	}
	for i, object := range l.Objects {
		out.Contents[i] = storageObjectDTO{Key: object.Key, LastModified: object.LastModified, ETag: object.ETag, Size: object.Size, StorageClass: object.StorageClass}
	}
	return out
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
