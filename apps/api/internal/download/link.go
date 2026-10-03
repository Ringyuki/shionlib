package download

import (
	"strings"
	"time"
)

const (
	ModeDirect = "direct"
	ModeWorker = "worker"

	TicketVersion = 3
)

type LinkSettings struct {
	Mode           string
	CDNHost        string
	WorkerHost     string
	MaxConns       int
	BaseExpiresIn  time.Duration
	EstimatedSpeed int64
	MaxExpiresIn   time.Duration
}

func (s LinkSettings) ExpiresIn(size int64) int64 {
	speed := max(1, s.EstimatedSpeed)
	estimated := int64(s.BaseExpiresIn/time.Second) + (size+speed-1)/speed
	return min(estimated, int64(s.MaxExpiresIn/time.Second))
}

type Link struct {
	URL       string
	ExpiresIn int64
}

type Verdict struct {
	Success    bool
	ErrorCodes []string
}

type Authorization struct {
	BucketName  string
	FileKey     string
	Token       string
	DownloadURL string
}

type Ticket struct {
	Version     int
	SessionID   string
	FileID      int
	FileName    string
	Expires     int64
	HardExpires int64
	MaxConns    int
	Bucket      string
	Key         string
	Token       string
	DownloadURL string
	GameID      int
}

type Object struct {
	Key         string
	LocalPath   string
	ContentType string
	Metadata    map[string]string
}

type ObjectInfo struct {
	Key          string
	LastModified *time.Time
	ETag         string
	Size         int64
	StorageClass string
}

type Listing struct {
	Name                  string
	Prefix                string
	KeyCount              int
	MaxKeys               int
	IsTruncated           bool
	ContinuationToken     string
	NextContinuationToken string
	Objects               []ObjectInfo
}

func EncodeURIComponent(value string) string {
	const hex = "0123456789ABCDEF"
	var builder strings.Builder
	builder.Grow(len(value))
	for i := range len(value) {
		c := value[i]
		if isURIComponentSafe(c) {
			builder.WriteByte(c)
			continue
		}
		builder.WriteByte('%')
		builder.WriteByte(hex[c>>4])
		builder.WriteByte(hex[c&0x0f])
	}
	return builder.String()
}

func isURIComponentSafe(c byte) bool {
	switch {
	case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9':
		return true
	}
	return strings.IndexByte("-_.!~*'()", c) >= 0
}
