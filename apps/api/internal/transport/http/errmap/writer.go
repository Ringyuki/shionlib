package errmap

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type Writer struct {
	logger *slog.Logger
}

func NewWriter(logger *slog.Logger) *Writer {
	return &Writer{logger: logger}
}

func (w *Writer) Write(rw http.ResponseWriter, r *http.Request, resp *ErrorResponse) {
	for key, values := range resp.GetHeaders() {
		for _, value := range values {
			rw.Header().Add(key, value)
		}
	}
	rw.Header().Set("Content-Type", "application/json; charset=utf-8")
	rw.WriteHeader(resp.GetStatus())
	if err := json.NewEncoder(rw).Encode(resp); err != nil {
		w.logger.WarnContext(r.Context(), "write error response failed", slog.Any("error", err))
	}
}
