package uploadhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type adminUploadUserDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type adminUploadGameDTO struct {
	_       struct{} `nullable:"true"`
	ID      int      `json:"id"`
	TitleJP string   `json:"title_jp"`
	TitleZH string   `json:"title_zh"`
	TitleEN string   `json:"title_en"`
}

type AdminUploadItemDTO struct {
	Kind         string              `json:"kind" enum:"session,attempt" doc:"An upload session, or a failure the browser reported before it opened one"`
	ID           int                 `json:"id" doc:"The session id, or the failure id of an attempt"`
	FileName     string              `json:"file_name"`
	Size         int64               `json:"size"`
	Uploader     adminUploadUserDTO  `json:"uploader"`
	Stage        string              `json:"stage" enum:"not_started,uploading,pending,processing,published,rejected,canceled,expired"`
	FileStage    *string             `json:"file_stage" enum:"checking,awaiting_volumes,storing,stored,under_review,stalled,rejected" doc:"Where the file made from the upload is; null before a file was made"`
	Rejection    *string             `json:"rejection" enum:"truncated,unsupported,encrypted,harmful,incomplete_set,abandoned" doc:"Why the check refused the file"`
	Received     int                 `json:"received" doc:"Chunks received"`
	Chunks       int                 `json:"chunks"`
	Game         *adminUploadGameDTO `json:"game" doc:"The game of the resource the file is in"`
	FailureCount int                 `json:"failure_count"`
	Started      time.Time           `json:"started"`
}

type adminUploadSessionDTO struct {
	_             struct{}   `nullable:"true"`
	ChunkSize     int64      `json:"chunk_size"`
	HashAlgorithm string     `json:"hash_algorithm" enum:"sha256,blake3"`
	FileHash      string     `json:"file_hash"`
	ExpiresAt     time.Time  `json:"expires_at"`
	LastChunkAt   *time.Time `json:"last_chunk_at"`
	CompletedAt   *time.Time `json:"completed_at"`
	SubmittedAt   *time.Time `json:"submitted_at"`
	AbortedAt     *time.Time `json:"aborted_at"`
	EndedAt       *time.Time `json:"ended_at"`
	Updated       time.Time  `json:"updated"`
}

type adminUploadTargetDTO struct {
	_                   struct{}   `nullable:"true"`
	FileID              int        `json:"file_id"`
	ResourceID          int        `json:"resource_id"`
	ResourceRemoved     bool       `json:"resource_removed"`
	ResourcePublishedAt *time.Time `json:"resource_published_at"`
	InspectionID        *int       `json:"inspection_id"`
}

type adminUploadErrorDTO struct {
	Name      string  `json:"name"`
	Message   string  `json:"message"`
	Status    *int    `json:"status"`
	Code      *int    `json:"code"`
	RequestID *string `json:"request_id"`
	Ray       *string `json:"ray"`
}

type adminUploadAttemptDTO struct {
	At    time.Time           `json:"at"`
	Wait  string              `json:"wait" enum:"network,busy,in_flight,signed_out"`
	Error adminUploadErrorDTO `json:"error"`
}

type adminUploadFailureDTO struct {
	ID        int                     `json:"id"`
	At        time.Time               `json:"at"`
	Stage     string                  `json:"stage" enum:"open,read,chunk,complete,submit"`
	Reason    string                  `json:"reason" enum:"different_file,changed_file,unreadable,expired,rejected"`
	Error     adminUploadErrorDTO     `json:"error"`
	Chunk     *int                    `json:"chunk"`
	FileName  string                  `json:"file_name"`
	FileSize  int64                   `json:"file_size"`
	Attempts  []adminUploadAttemptDTO `json:"attempts" doc:"Tries retried before the failure, oldest first"`
	Client    string                  `json:"client"`
	IP        string                  `json:"ip"`
	UserAgent string                  `json:"user_agent"`
}

type adminUploadDTO struct {
	AdminUploadItemDTO
	Session  *adminUploadSessionDTO  `json:"session" doc:"Null for an attempt"`
	Target   *adminUploadTargetDTO   `json:"target" doc:"The resource file made from the upload; null before one was made"`
	Held     bool                    `json:"held" doc:"A browser is uploading it right now"`
	Failures []adminUploadFailureDTO `json:"failures" doc:"Newest first"`
}

func toAdminUploadItem(entry download.Upload) AdminUploadItemDTO {
	dto := AdminUploadItemDTO{
		Kind:         string(entry.Kind),
		ID:           entry.ID,
		FileName:     entry.FileName,
		Size:         entry.Size,
		Uploader:     adminUploadUserDTO{ID: entry.UserID, Name: entry.UserName},
		Stage:        string(entry.Stage),
		FailureCount: entry.FailureCount,
		Started:      entry.Started,
	}
	if entry.Session != nil {
		dto.Received, dto.Chunks = entry.Session.ReceivedChunks(), entry.Session.TotalChunks
	}
	if stage := entry.FileStage(); stage != nil {
		value := string(*stage)
		dto.FileStage = &value
	}
	if entry.Target != nil {
		if rejection, ok := entry.Target.File.CheckStatus.Rejection(); ok {
			value := string(rejection)
			dto.Rejection = &value
		}
		game := entry.Target.Game
		dto.Game = &adminUploadGameDTO{ID: game.ID, TitleJP: game.TitleJP, TitleZH: game.TitleZH, TitleEN: game.TitleEN}
	}
	return dto
}

func toAdminUpload(detail download.UploadDetail) adminUploadDTO {
	dto := adminUploadDTO{AdminUploadItemDTO: toAdminUploadItem(detail.Upload), Held: detail.Held, Failures: make([]adminUploadFailureDTO, len(detail.Failures))}
	if session := detail.Session; session != nil {
		dto.Session = &adminUploadSessionDTO{
			ChunkSize:     session.ChunkSize,
			HashAlgorithm: string(session.HashAlgorithm),
			FileHash:      session.FileHash,
			ExpiresAt:     session.ExpiresAt,
			LastChunkAt:   session.LastChunkAt,
			CompletedAt:   session.CompletedAt,
			SubmittedAt:   session.SubmittedAt,
			AbortedAt:     session.AbortedAt,
			EndedAt:       session.EndedAt,
			Updated:       session.Updated,
		}
	}
	if target := detail.Target; target != nil {
		dto.Target = &adminUploadTargetDTO{
			FileID:              target.FileID,
			ResourceID:          target.ResourceID,
			ResourceRemoved:     target.ResourceStatus != download.ResourceActive,
			ResourcePublishedAt: target.ResourcePublishedAt,
			InspectionID:        target.File.InspectionID,
		}
	}
	for i, failure := range detail.Failures {
		dto.Failures[i] = toAdminUploadFailure(failure)
	}
	return dto
}

func toAdminUploadFailure(failure upload.Failure) adminUploadFailureDTO {
	attempts := make([]adminUploadAttemptDTO, len(failure.Attempts))
	for i, attempt := range failure.Attempts {
		attempts[i] = adminUploadAttemptDTO{At: attempt.At, Wait: attempt.Wait, Error: toAdminUploadError(attempt.Error)}
	}
	return adminUploadFailureDTO{
		ID:        failure.ID,
		At:        failure.At,
		Stage:     string(failure.Stage),
		Reason:    failure.Reason,
		Error:     toAdminUploadError(failure.Error),
		Chunk:     failure.Chunk,
		FileName:  failure.FileName,
		FileSize:  failure.FileSize,
		Attempts:  attempts,
		Client:    failure.Client,
		IP:        failure.IP,
		UserAgent: failure.UserAgent,
	}
}

func toAdminUploadError(e upload.ClientError) adminUploadErrorDTO {
	return adminUploadErrorDTO{Name: e.Name, Message: e.Message, Status: e.Status, Code: e.Code, RequestID: e.RequestID, Ray: e.Ray}
}
