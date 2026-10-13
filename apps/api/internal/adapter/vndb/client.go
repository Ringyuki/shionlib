package vndb

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const (
	DefaultBaseURL = "https://api.vndb.org/kana"
	maxBodyBytes   = 1 << 20
)

type Client struct {
	http    *http.Client
	baseURL string
}

func NewClient(httpClient *http.Client, baseURL string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{http: httpClient, baseURL: strings.TrimSuffix(baseURL, "/")}
}

type query struct {
	Filters []string `json:"filters"`
	Fields  string   `json:"fields"`
}

type ratingResult struct {
	ID        string   `json:"id"`
	Rating    *float64 `json:"rating"`
	Average   *float64 `json:"average"`
	VoteCount int      `json:"votecount"`
}

func requestFailed(cause error, message string) error {
	return game.ErrVNDBRequestFailed.Wrap(cause).WithArgs(map[string]any{"message": message})
}

func (c *Client) Rating(ctx context.Context, vndbID string) (game.VNDBScore, bool, error) {
	payload, err := json.Marshal(query{Filters: []string{"id", "=", vndbID}, Fields: "rating,average,votecount"})
	if err != nil {
		return game.VNDBScore{}, false, fmt.Errorf("encode vndb query: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/vn", bytes.NewReader(payload))
	if err != nil {
		return game.VNDBScore{}, false, fmt.Errorf("build vndb request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return game.VNDBScore{}, false, requestFailed(err, "network error")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		message := "Request failed with status code " + strconv.Itoa(resp.StatusCode)
		return game.VNDBScore{}, false, requestFailed(errors.New(message), message)
	}
	var body struct {
		Results []ratingResult `json:"results"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxBodyBytes)).Decode(&body); err != nil {
		return game.VNDBScore{}, false, requestFailed(err, "invalid response")
	}
	if len(body.Results) == 0 {
		return game.VNDBScore{}, false, nil
	}
	first := body.Results[0]
	return game.VNDBScore{ID: first.ID, Rating: first.Rating, Average: first.Average, VoteCount: first.VoteCount}, true, nil
}
