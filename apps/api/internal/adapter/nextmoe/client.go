package nextmoe

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

const maxResponseBytes = 4 << 20

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

type patchList struct {
	Items []struct {
		ID            string            `json:"id"`
		VNDBID        string            `json:"vndb_id"`
		CatalogWorkID *string           `json:"catalog_work_id"`
		ResourceCount int               `json:"resource_count"`
		WebURL        string            `json:"web_url"`
		Resources     []json.RawMessage `json:"resources"`
	} `json:"items"`
}

type catalogTitle struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
}

type titleList struct {
	Items []catalogTitle `json:"items"`
}

type patchResourceOwner struct {
	PatchID string `json:"patch_id"`
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
		if numericID.MatchString(item.ID) && !slices.Contains(works, item.ID) {
			works = append(works, item.ID)
		}
	}
	return works, nil
}

func (c *Client) Entries(ctx context.Context, query moyu.PageQuery) ([]moyu.Entry, error) {
	list, err := c.patches(ctx, query, "resources,publisher")
	if err != nil {
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

func (c *Client) Pages(ctx context.Context, query moyu.PageQuery) ([]moyu.Page, error) {
	list, err := c.patches(ctx, query, "")
	if err != nil {
		return nil, err
	}
	pages := []moyu.Page{}
	works := []string{}
	for _, item := range list.Items {
		page, ok := pageOf(item.ID, item.VNDBID, item.CatalogWorkID, item.ResourceCount, item.WebURL)
		if !ok || slices.ContainsFunc(pages, func(seen moyu.Page) bool { return seen.ID == page.ID }) {
			continue
		}
		pages = append(pages, page)
		if page.WorkID != "" && !slices.Contains(works, page.WorkID) {
			works = append(works, page.WorkID)
		}
	}
	if len(works) == 0 {
		return pages, nil
	}
	var titles titleList
	if err := c.get(ctx, "/v2/catalog/works", url.Values{"ids": {strings.Join(works, ",")}, "nsfw": {"true"}}, &titles); err != nil {
		return nil, err
	}
	for i, page := range pages {
		if at := slices.IndexFunc(titles.Items, func(work catalogTitle) bool { return work.ID == page.WorkID }); at >= 0 {
			pages[i].Title = trimmed(titles.Items[at].DisplayName)
		}
	}
	return pages, nil
}

func (c *Client) PageOfResource(ctx context.Context, resourceID string) (string, bool, error) {
	if !moyu.IsPageID(resourceID) {
		return "", false, nil
	}
	var owner patchResourceOwner
	found, err := c.fetch(ctx, "/v2/moyu/resources/"+resourceID, url.Values{}, &owner)
	if err != nil || !found || !moyu.IsPageID(owner.PatchID) {
		return "", false, err
	}
	return owner.PatchID, true, nil
}

func (c *Client) patches(ctx context.Context, query moyu.PageQuery, include string) (patchList, error) {
	values := url.Values{"nsfw": {"true"}}
	if include != "" {
		values.Set("include", include)
	}
	if ids := pageIDsOf(query.IDs); len(ids) > 0 {
		values.Set("ids", strings.Join(ids, ","))
	} else if refs := refsOf(query); len(refs) > 0 {
		values.Set("refs", strings.Join(refs, ","))
	} else {
		return patchList{}, nil
	}
	var list patchList
	err := c.get(ctx, "/v2/moyu/patches", values, &list)
	return list, err
}

func refsOf(query moyu.PageQuery) []string {
	refs := []string{}
	if ref, ok := refOf(refVNDB, query.VNDBID); ok {
		refs = append(refs, ref)
	}
	for _, work := range query.Works {
		if ref, ok := refOf(refCatalog, work); ok {
			refs = append(refs, ref)
		}
	}
	return refs
}

func pageIDsOf(ids []string) []string {
	kept := []string{}
	for _, id := range ids {
		if moyu.IsPageID(id) && !slices.Contains(kept, id) {
			kept = append(kept, id)
		}
	}
	return kept
}

func (c *Client) get(ctx context.Context, path string, query url.Values, dst any) error {
	found, err := c.fetch(ctx, path, query, dst)
	if err == nil && !found {
		return moyu.ErrRequestFailed.Wrap(fmt.Errorf("nextmoe %s?%s returned %d", path, query.Encode(), http.StatusNotFound))
	}
	return err
}

func (c *Client) fetch(ctx context.Context, path string, query url.Values, dst any) (bool, error) {
	target := path
	if encoded := query.Encode(); encoded != "" {
		target += "?" + encoded
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+target, nil)
	if err != nil {
		return false, fmt.Errorf("build nextmoe request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return false, moyu.ErrRequestFailed.Wrap(fmt.Errorf("nextmoe %s: %w", target, err))
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return false, moyu.ErrRequestFailed.Wrap(fmt.Errorf("nextmoe %s returned %d", target, resp.StatusCode))
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(dst); err != nil {
		return false, moyu.ErrRequestFailed.Wrap(fmt.Errorf("decode nextmoe %s: %w", target, err))
	}
	return true, nil
}
