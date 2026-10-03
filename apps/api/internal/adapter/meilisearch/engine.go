package meilisearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"unicode"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

const (
	highlightPreTag  = `<span class="search-highlight">`
	highlightPostTag = `</span>`
	maxBodyBytes     = 8 << 20
)

var repeatedSpace = regexp.MustCompile(`\s{2,}`)

type Options struct {
	HTTP   *http.Client
	Host   string
	APIKey string
	Index  string
}

type Engine struct {
	opts Options
}

func NewEngine(opts Options) *Engine {
	opts.Host = strings.TrimSuffix(opts.Host, "/")
	return &Engine{opts: opts}
}

type searchRequest struct {
	Q                     string   `json:"q"`
	Page                  int      `json:"page"`
	HitsPerPage           int      `json:"hitsPerPage"`
	Filter                []string `json:"filter,omitempty"`
	Sort                  []string `json:"sort"`
	AttributesToRetrieve  []string `json:"attributesToRetrieve"`
	AttributesToHighlight []string `json:"attributesToHighlight"`
	HighlightPreTag       string   `json:"highlightPreTag"`
	HighlightPostTag      string   `json:"highlightPostTag"`
}

type formatted struct {
	TitleJP *string  `json:"title_jp"`
	TitleZH *string  `json:"title_zh"`
	TitleEN *string  `json:"title_en"`
	IntroJP *string  `json:"intro_jp"`
	IntroZH *string  `json:"intro_zh"`
	IntroEN *string  `json:"intro_en"`
	Aliases []string `json:"aliases"`
}

type searchResponse struct {
	Hits []struct {
		ID        int        `json:"id"`
		Formatted *formatted `json:"_formatted"`
	} `json:"hits"`
	TotalHits  *int `json:"totalHits"`
	TotalPages *int `json:"totalPages"`
}

func Sanitize(q string) string {
	runes := []rune(strings.TrimRight(strings.TrimLeft(q, "-"), "-"))
	var b strings.Builder
	for i, r := range runes {
		negation := r == '-' && (i == 0 || unicode.IsSpace(runes[i-1])) && i+1 < len(runes) && !unicode.IsSpace(runes[i+1])
		if !negation {
			b.WriteRune(r)
		}
	}
	return strings.TrimSpace(repeatedSpace.ReplaceAllString(b.String(), " "))
}

func escapeFilter(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, `\`, `\\`), `"`, `\"`)
}

func (e *Engine) Search(ctx context.Context, criteria search.Criteria) (search.Result, error) {
	request := searchRequest{
		Q:                     Sanitize(criteria.Q),
		Page:                  criteria.Page.Number,
		HitsPerPage:           criteria.Page.Size,
		Sort:                  []string{"release_date:desc", "id:desc"},
		AttributesToRetrieve:  []string{"id", "title_jp", "title_zh", "title_en", "aliases", "intro_jp", "intro_zh", "intro_en"},
		AttributesToHighlight: []string{"title_jp", "title_zh", "title_en", "intro_jp", "intro_zh", "intro_en", "aliases"},
		HighlightPreTag:       highlightPreTag,
		HighlightPostTag:      highlightPostTag,
	}
	if criteria.ExcludeRated {
		request.Filter = append(request.Filter, "nsfw = false", "max_cover_sexual = 0")
	}
	if criteria.Tag != "" {
		request.Filter = append(request.Filter, `tags = "`+escapeFilter(criteria.Tag)+`"`)
	}
	payload, err := json.Marshal(request)
	if err != nil {
		return search.Result{}, fmt.Errorf("encode meilisearch query: %w", err)
	}
	endpoint := e.opts.Host + "/indexes/" + url.PathEscape(e.opts.Index) + "/search"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return search.Result{}, fmt.Errorf("build meilisearch request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if e.opts.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+e.opts.APIKey)
	}
	resp, err := e.opts.HTTP.Do(req)
	if err != nil {
		return search.Result{}, fmt.Errorf("query meilisearch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return search.Result{}, fmt.Errorf("meilisearch index %s not found; build the index before enabling the meilisearch engine", e.opts.Index)
	}
	if resp.StatusCode != http.StatusOK {
		return search.Result{}, errors.New("query meilisearch: status " + resp.Status)
	}
	var body searchResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxBodyBytes)).Decode(&body); err != nil {
		return search.Result{}, fmt.Errorf("decode meilisearch response: %w", err)
	}
	result := search.Result{Hits: make([]search.Hit, len(body.Hits))}
	for i, hit := range body.Hits {
		result.Hits[i] = search.Hit{GameID: hit.ID}
		if f := hit.Formatted; f != nil {
			result.Hits[i].Highlight = &search.Highlight{
				TitleJP: f.TitleJP, TitleZH: f.TitleZH, TitleEN: f.TitleEN,
				IntroJP: f.IntroJP, IntroZH: f.IntroZH, IntroEN: f.IntroEN,
				Aliases: f.Aliases,
			}
		}
	}
	if body.TotalHits != nil {
		result.Total = *body.TotalHits
	}
	switch {
	case body.TotalPages != nil:
		result.TotalPages = *body.TotalPages
	case criteria.Page.Size > 0:
		result.TotalPages = (result.Total + criteria.Page.Size - 1) / criteria.Page.Size
	}
	return result, nil
}
