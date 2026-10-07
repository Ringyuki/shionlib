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
	Stage                download.Stage           `json:"stage" enum:"checking,storing,stored,under_review,rejected" doc:"Where the file is on its way to being downloadable: checking (waiting for or under its check), storing (passed, moving to object storage), stored, under_review (held for a malware review) or rejected (about to be removed)"`
	Rejection            *download.Rejection      `json:"rejection" enum:"truncated,unsupported,encrypted,harmful,incomplete_set" doc:"Why a rejected file was rejected; null otherwise"`
	IsVirusFalsePositive bool                     `json:"is_virus_false_positive"`
	MalwareScanCases     []downloadMalwareCaseDTO `json:"malware_scan_cases"`
	Creator              userhttp.UserSummaryDTO  `json:"creator"`
	LatestHistory        *downloadHistoryRefDTO   `json:"latest_history"`
}

type downloadResourceDTO struct {
	ID          int                     `json:"id"`
	Platform    []string                `json:"platform"`
	Language    []string                `json:"language"`
	Simulator   *string                 `json:"simulator"`
	Note        *string                 `json:"note"`
	Downloads   int                     `json:"downloads"`
	Creator     userhttp.UserSummaryDTO `json:"creator"`
	PublishedAt *time.Time              `json:"published_at" doc:"Null while the resource is still being checked; only its uploader sees it then"`
	Created     time.Time               `json:"created"`
	Updated     time.Time               `json:"updated"`
	Files       []downloadFileDTO       `json:"files"`
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
		ID:          r.ID,
		Platform:    nonNil(r.Platforms),
		Language:    nonNil(r.Languages),
		Simulator:   r.Simulator,
		Note:        r.Note,
		Downloads:   r.Downloads,
		Creator:     userhttp.ToUserSummary(r.Creator, now),
		PublishedAt: r.PublishedAt,
		Created:     r.Created,
		Updated:     r.Updated,
		Files:       make([]downloadFileDTO, len(r.Files)),
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
			Stage:                file.Stage(),
			IsVirusFalsePositive: file.FalsePositive,
			MalwareScanCases:     cases,
			Creator:              userhttp.ToUserSummary(file.Creator, now),
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
