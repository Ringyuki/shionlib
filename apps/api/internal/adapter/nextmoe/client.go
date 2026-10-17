package nextmoe

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

const (
	maxResponseBytes = 4 << 20
	searchLimit      = 10
)

type Client struct {
	http    *http.Client
	baseURL string
	apiKey  string
}

func NewClient(httpClient *http.Client, baseURL, apiKey string) *Client {
	return &Client{http: httpClient, baseURL: strings.TrimSuffix(baseURL, "/"), apiKey: apiKey}
}

type workList struct {
	Items []struct {
		ID string `json:"id"`
	} `json:"items"`
}

type titledList struct {
	Items []struct {
		ID          string  `json:"id"`
		DisplayName string  `json:"display_name"`
		Latin       *string `json:"latin"`
		Localized   map[string]struct {
			Value     string `json:"value"`
			IsMachine bool   `json:"is_machine"`
		} `json:"localized"`
		ReleaseDate *string `json:"release_date"`
	} `json:"items"`
}

type patchList struct {
	Items []struct {
		Resources []json.RawMessage `json:"resources"`
	} `json:"items"`
}

func (c *Client) Works(ctx context.Context, anchors []moyu.Anchor) ([]string, error) {
	refs := []string{}
	for _, anchor := range anchors {
		if ref, ok := refOf(sources[anchor.Source], anchor.ID); ok {
			refs = append(refs, ref)
		}
	}
	if len(refs) == 0 {
		return []string{}, nil
	}
	var list workList
	if err := c.get(ctx, "/v2/catalog/works", url.Values{"refs": {strings.Join(refs, ",")}, "nsfw": {"true"}}, &list); err != nil {
		return nil, err
	}
	works := []string{}
	for _, item := range list.Items {
		if workID.MatchString(item.ID) && !slices.Contains(works, item.ID) {
			works = append(works, item.ID)
		}
	}
	return works, nil
}

func (c *Client) Titled(ctx context.Context, title string) ([]moyu.Work, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return []moyu.Work{}, nil
	}
	var list titledList
	query := url.Values{"q": {title}, "nsfw": {"true"}, "include": {"titles"}, "limit": {strconv.Itoa(searchLimit)}}
	if err := c.get(ctx, "/v2/catalog/works", query, &list); err != nil {
		return nil, err
	}
	works := []moyu.Work{}
	for _, item := range list.Items {
		if !workID.MatchString(item.ID) {
			continue
		}
		work := moyu.Work{ID: item.ID, Titles: []string{}, Released: dateOf(item.ReleaseDate)}
		names := []string{item.DisplayName}
		if item.Latin != nil {
			names = append(names, *item.Latin)
		}
		for _, localized := range item.Localized {
			if !localized.IsMachine {
				names = append(names, localized.Value)
			}
		}
		for _, name := range names {
			if name = trimmed(name); name != "" {
				work.Titles = append(work.Titles, name)
			}
		}
		works = append(works, work)
	}
	return works, nil
}

func (c *Client) Entries(ctx context.Context, vndbID string, works []string) ([]moyu.Entry, error) {
	refs := []string{}
	if ref, ok := refOf(refVNDB, vndbID); ok {
		refs = append(refs, ref)
	}
	for _, work := range works {
		if ref, ok := refOf(refCatalog, work); ok {
			refs = append(refs, ref)
		}
	}
	if len(refs) == 0 {
		return []moyu.Entry{}, nil
	}
	var list patchList
	query := url.Values{"refs": {strings.Join(refs, ",")}, "nsfw": {"true"}, "include": {"resources,publisher"}}
	if err := c.get(ctx, "/v2/moyu/patches", query, &list); err != nil {
		return nil, err
	}
	entries := []moyu.Entry{}
	seen := map[string]bool{}
	for _, item := range list.Items {
		for _, raw := range item.Resources {
			if entry, ok := entryOf(raw); ok && !seen[entry.ID] {
				seen[entry.ID] = true
				entries = append(entries, entry)
			}
		}
	}
	return entries, nil
}

func (c *Client) get(ctx context.Context, path string, query url.Values, dst any) error {
	target := path + "?" + query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+target, nil)
	if err != nil {
		return fmt.Errorf("build nextmoe request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return moyu.ErrRequestFailed.Wrap(fmt.Errorf("nextmoe %s: %w", target, err))
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return moyu.ErrRequestFailed.Wrap(fmt.Errorf("nextmoe %s returned %d", target, resp.StatusCode))
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(dst); err != nil {
		return moyu.ErrRequestFailed.Wrap(fmt.Errorf("decode nextmoe %s: %w", target, err))
	}
	return nil
}
