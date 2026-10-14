package uploadpg

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type clientErrorRecord struct {
	Name      string  `json:"name"`
	Message   string  `json:"message"`
	Status    *int    `json:"status,omitempty"`
	Code      *int    `json:"code,omitempty"`
	RequestID *string `json:"request_id,omitempty"`
	Ray       *string `json:"ray,omitempty"`
}

type failureAttemptRecord struct {
	At    time.Time         `json:"at"`
	Wait  string            `json:"wait"`
	Error clientErrorRecord `json:"error"`
}

func (r *Repository) RecordFailure(ctx context.Context, userID int, report upload.FailureReport, at time.Time) (int, error) {
	attempts := make([]failureAttemptRecord, len(report.Attempts))
	for i, attempt := range report.Attempts {
		attempts[i] = failureAttemptRecord{At: attempt.At.UTC(), Wait: attempt.Wait, Error: clientErrorRecordOf(attempt.Error)}
	}
	encoded, err := json.Marshal(attempts)
	if err != nil {
		return 0, fmt.Errorf("encode the attempts of an upload failure: %w", err)
	}
	row, err := r.db(ctx).UploadFailure.Create().
		SetUserID(userID).
		SetNillableSessionID(report.SessionID).
		SetStage(string(report.Stage)).
		SetReason(report.Reason).
		SetErrorName(report.Error.Name).
		SetErrorMessage(report.Error.Message).
		SetNillableStatus(report.Error.Status).
		SetNillableCode(report.Error.Code).
		SetNillableRequestID(report.Error.RequestID).
		SetNillableRay(report.Error.Ray).
		SetNillableChunk(report.Chunk).
		SetFileName(report.FileName).
		SetFileSize(report.FileSize).
		SetAttempts(encoded).
		SetClient(report.Client).
		SetIP(report.IP).
		SetUserAgent(report.UserAgent).
		SetCreated(at).
		Save(ctx)
	if err != nil {
		return 0, fmt.Errorf("record an upload failure of user %d: %w", userID, err)
	}
	return row.ID, nil
}

func clientErrorRecordOf(e upload.ClientError) clientErrorRecord {
	return clientErrorRecord{Name: e.Name, Message: e.Message, Status: e.Status, Code: e.Code, RequestID: e.RequestID, Ray: e.Ray}
}
