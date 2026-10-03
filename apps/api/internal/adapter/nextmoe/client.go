package nextmoe

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

type patchList struct {
	Items []struct {
		Resources []json.RawMessage `json:"resources"`
	} `json:"items"`
}

func (c *Client) ResourcesByVNDBID(ctx context.Context, vndbID string) (moyu.Lookup, error) {
	query := url.Values{"refs": {"vndb:" + vndbID}, "nsfw": {"true"}, "include": {"resources,publisher"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/v2/moyu/patches?"+query.Encode(), nil)
	if err != nil {
		return moyu.Lookup{}, fmt.Errorf("build nextmoe request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return moyu.Lookup{}, moyu.ErrRequestFailed.Wrap(fmt.Errorf("nextmoe patches for %s: %w", vndbID, err))
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return moyu.Lookup{}, moyu.ErrRequestFailed.Wrap(fmt.Errorf("nextmoe patches for %s returned %d", vndbID, resp.StatusCode))
	}
	var list patchList
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(&list); err != nil {
		return moyu.Lookup{}, moyu.ErrRequestFailed.Wrap(fmt.Errorf("decode nextmoe patches for %s: %w", vndbID, err))
	}
	if len(list.Items) == 0 {
		return moyu.Lookup{}, nil
	}
	resources := list.Items[0].Resources
	if resources == nil {
		resources = []json.RawMessage{}
	}
	return moyu.Lookup{Found: true, Resources: resources}, nil
}
