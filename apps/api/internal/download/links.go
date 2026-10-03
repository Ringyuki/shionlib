package download

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Links struct {
	repo       Repository
	tx         Transactor
	challenge  Challenge
	authorizer Authorizer
	sealer     TicketSealer
	settings   LinkSettings
	now        func() time.Time
}

func NewLinks(repo Repository, tx Transactor, challenge Challenge, authorizer Authorizer, sealer TicketSealer, settings LinkSettings, now func() time.Time) *Links {
	return &Links{repo: repo, tx: tx, challenge: challenge, authorizer: authorizer, sealer: sealer, settings: settings, now: now}
}

func (l *Links) Issue(ctx context.Context, fileID int, token string) (Link, error) {
	if token == "" {
		return Link{}, ErrTokenRequired
	}
	verdict, err := l.challenge.Verify(ctx, token)
	if err != nil {
		return Link{}, err
	}
	if !verdict.Success {
		return Link{}, ErrInvalidToken.WithArgs(map[string]any{"errorCodes": strings.Join(verdict.ErrorCodes, ",")})
	}
	file, err := l.repo.GetFile(ctx, fileID)
	if err != nil {
		return Link{}, err
	}
	if file.ResourceStatus != ResourceActive || file.Status != FileInObjectStore || file.StorageKey == nil || *file.StorageKey == "" {
		return Link{}, ErrFileNotFound
	}
	expiresIn := l.settings.ExpiresIn(file.Size)
	url, err := l.url(ctx, file, expiresIn)
	if err != nil {
		return Link{}, err
	}
	if err := l.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		return l.repo.CountDownload(ctx, file.ResourceID, file.GameID)
	}); err != nil {
		return Link{}, err
	}
	return Link{URL: url, ExpiresIn: expiresIn}, nil
}

func (l *Links) url(ctx context.Context, file File, expiresIn int64) (string, error) {
	key := *file.StorageKey
	if l.settings.Mode != ModeWorker {
		auth, err := l.authorizer.Authorize(ctx, key, time.Duration(expiresIn)*time.Second)
		if err != nil {
			return "", err
		}
		host := l.settings.CDNHost
		if !strings.HasSuffix(host, "/") {
			host += "/"
		}
		return host + EncodeURIComponent(key) + "?Authorization=" + auth.Token, nil
	}
	maxExpiresIn := int64(l.settings.MaxExpiresIn / time.Second)
	auth, err := l.authorizer.Authorize(ctx, key, l.settings.MaxExpiresIn)
	if err != nil {
		return "", err
	}
	now := l.now().Unix()
	ticket := Ticket{
		Version:     TicketVersion,
		SessionID:   uuid.NewString(),
		FileID:      file.ID,
		FileName:    file.Name,
		Expires:     now + expiresIn,
		HardExpires: now + maxExpiresIn,
		MaxConns:    max(1, l.settings.MaxConns),
		Bucket:      auth.BucketName,
		Key:         auth.FileKey,
		Token:       auth.Token,
		DownloadURL: auth.DownloadURL,
		GameID:      file.GameID,
	}
	sealed, err := l.sealer.Seal(ticket)
	if err != nil {
		return "", err
	}
	host := strings.TrimSuffix(l.settings.WorkerHost, "/")
	if host == "" {
		return "", ErrWorkerHostMissing
	}
	return host + "/dl/" + strconv.Itoa(file.ID) + "/" + EncodeURIComponent(ticket.SessionID) + "?ticket=" + EncodeURIComponent(sealed), nil
}
