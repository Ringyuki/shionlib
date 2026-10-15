package uploadhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type clientErrorInput struct {
	Name      string  `json:"name" maxLength:"100" doc:"Name of the error in the browser: ApiError for an answer of the API or of a proxy in front of it, NotReadableError when the file could not be read, TypeError for a failed connection"`
	Message   string  `json:"message" maxLength:"2000"`
	Status    *int    `json:"status,omitempty" minimum:"0" maximum:"999" doc:"HTTP status of the answer"`
	Code      *int    `json:"code,omitempty" doc:"Business code of the answer"`
	RequestID *string `json:"request_id,omitempty" maxLength:"100" doc:"The API's request id; absent when the answer did not come from the API"`
	Ray       *string `json:"ray,omitempty" maxLength:"100" doc:"Cloudflare's Ray ID of the answer"`
}

func (e clientErrorInput) clientError() upload.ClientError {
	return upload.ClientError{Name: e.Name, Message: e.Message, Status: e.Status, Code: e.Code, RequestID: e.RequestID, Ray: e.Ray}
}

type failureAttemptInput struct {
	At    time.Time        `json:"at"`
	Wait  string           `json:"wait" enum:"network,busy,in_flight,signed_out" doc:"What the browser waited for before trying again"`
	Error clientErrorInput `json:"error"`
}

type reportFailureInput struct {
	Client string `header:"X-Upload-Client" maxLength:"64" pattern:"^[A-Za-z0-9-]*$" doc:"Identifies the browser that uploaded"`
	Body   struct {
		SessionID  *int                  `json:"session_id,omitempty" minimum:"1" doc:"The upload session, when one was opened"`
		SessionIDs []int                 `json:"session_ids,omitempty" maxItems:"100" doc:"The upload sessions of the files a failed submission was made of; the failure is recorded once for each"`
		Stage      string                `json:"stage" enum:"open,read,chunk,complete,submit" doc:"Opening the session, reading the file, sending a chunk, completing the session, or creating the resource from the finished uploads"`
		Reason     string                `json:"reason" enum:"different_file,changed_file,unreadable,expired,rejected" doc:"What the browser concluded and showed"`
		Error      clientErrorInput      `json:"error"`
		Chunk      *int                  `json:"chunk,omitempty" minimum:"0"`
		FileName   string                `json:"file_name" maxLength:"1000"`
		FileSize   int64                 `json:"file_size" minimum:"0"`
		Attempts   []failureAttemptInput `json:"attempts,omitempty" maxItems:"10" doc:"The last tries that failed and were retried before this failure, oldest first"`
	}
}

func (in *reportFailureInput) report(info clientinfo.Info) upload.FailureReport {
	attempts := make([]upload.FailureAttempt, len(in.Body.Attempts))
	for i, attempt := range in.Body.Attempts {
		attempts[i] = upload.FailureAttempt{At: attempt.At, Wait: attempt.Wait, Error: attempt.Error.clientError()}
	}
	return upload.FailureReport{
		SessionID:  in.Body.SessionID,
		SessionIDs: in.Body.SessionIDs,
		Stage:      upload.FailureStage(in.Body.Stage),
		Reason:     in.Body.Reason,
		Error:      in.Body.Error.clientError(),
		Chunk:      in.Body.Chunk,
		FileName:   in.Body.FileName,
		FileSize:   in.Body.FileSize,
		Attempts:   attempts,
		Client:     in.Client,
		IP:         info.IP,
		UserAgent:  info.UserAgent,
	}
}
