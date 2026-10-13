package vndb_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/vndb"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

func TestRating(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Filters []string `json:"filters"`
			Fields  string   `json:"fields"`
		}
		if r.Method != http.MethodPost || r.URL.Path != "/vn" || json.NewDecoder(r.Body).Decode(&body) != nil || body.Fields != "rating,average,votecount" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		switch body.Filters[2] {
		case "v17":
			_, _ = w.Write([]byte(`{"results":[{"id":"v17","rating":85.21,"average":8.4,"votecount":1200}],"more":false}`))
		case "v500":
			w.WriteHeader(http.StatusInternalServerError)
		default:
			_, _ = w.Write([]byte(`{"results":[],"more":false}`))
		}
	}))
	t.Cleanup(server.Close)
	client := vndb.NewClient(server.Client(), server.URL)
	ctx := context.Background()

	score, found, err := client.Rating(ctx, "v17")
	if err != nil || !found || score.ID != "v17" || *score.Rating != 85.21 || *score.Average != 8.4 || score.VoteCount != 1200 {
		t.Fatalf("rating: %+v %v %v", score, found, err)
	}
	if _, found, err := client.Rating(ctx, "v1"); err != nil || found {
		t.Fatalf("unknown entry: %v %v", found, err)
	}
	if _, _, err := client.Rating(ctx, "v500"); !errors.Is(err, game.ErrVNDBRequestFailed) {
		t.Fatalf("upstream failure: %v", err)
	}
}
