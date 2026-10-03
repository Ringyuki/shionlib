package apperror

type Kind uint8

const (
	KindInternal Kind = iota
	KindInvalidArgument
	KindUnprocessable
	KindUnauthenticated
	KindPermissionDenied
	KindNotFound
	KindConflict
	KindGone
	KindPayloadTooLarge
	KindUnsupportedMediaType
	KindRateLimited
	KindUpstreamFailed
	KindUnavailable
	KindNotImplemented
)

var kindNames = map[Kind]string{
	KindInternal:             "internal",
	KindInvalidArgument:      "invalid_argument",
	KindUnprocessable:        "unprocessable",
	KindUnauthenticated:      "unauthenticated",
	KindPermissionDenied:     "permission_denied",
	KindNotFound:             "not_found",
	KindConflict:             "conflict",
	KindGone:                 "gone",
	KindPayloadTooLarge:      "payload_too_large",
	KindUnsupportedMediaType: "unsupported_media_type",
	KindRateLimited:          "rate_limited",
	KindUpstreamFailed:       "upstream_failed",
	KindUnavailable:          "unavailable",
	KindNotImplemented:       "not_implemented",
}

func (k Kind) String() string {
	if name, ok := kindNames[k]; ok {
		return name
	}
	return "unknown"
}
