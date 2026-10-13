package b2

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const (
	DefaultAuthURL = "https://api.backblazeb2.com/b2api/v4/b2_authorize_account"
	accountKey     = "download:b2:account"
	accountTTL     = 21 * time.Hour
	maxBodyBytes   = 1 << 20
)

var errUnauthorized = errors.New("b2 rejected the account token")

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
	Delete(ctx context.Context, keys ...string) error
}

type Options struct {
	KeyID   string
	Key     string
	AuthURL string
	Client  *http.Client
	Cache   Cache
}

type Authorizer struct {
	keyID   string
	key     string
	authURL string
	client  *http.Client
	cache   Cache
}

func New(opts Options) *Authorizer {
	if opts.AuthURL == "" {
		opts.AuthURL = DefaultAuthURL
	}
	return &Authorizer{keyID: opts.KeyID, key: opts.Key, authURL: opts.AuthURL, client: opts.Client, cache: opts.Cache}
}

type account struct {
	Token       string `json:"authorization_token"`
	BucketID    string `json:"bucket_id"`
	BucketName  string `json:"bucket_name"`
	APIURL      string `json:"api_url"`
	DownloadURL string `json:"download_url"`
}

type authorizeAccountResponse struct {
	AuthorizationToken string `json:"authorizationToken"`
	APIInfo            struct {
		StorageAPI struct {
			APIURL      string `json:"apiUrl"`
			DownloadURL string `json:"downloadUrl"`
			Allowed     struct {
				Buckets []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"buckets"`
			} `json:"allowed"`
		} `json:"storageApi"`
	} `json:"apiInfo"`
}

type downloadAuthorizationRequest struct {
	BucketID               string `json:"bucketId"`
	FileNamePrefix         string `json:"fileNamePrefix"`
	ValidDurationInSeconds int    `json:"validDurationInSeconds"`
}

type downloadAuthorizationResponse struct {
	AuthorizationToken string `json:"authorizationToken"`
}

func (a *Authorizer) Authorize(ctx context.Context, key string, validFor time.Duration) (download.Authorization, error) {
	acct, err := a.account(ctx, false)
	if err != nil {
		return download.Authorization{}, err
	}
	token, err := a.downloadToken(ctx, acct, key, validFor)
	if errors.Is(err, errUnauthorized) {
		if acct, err = a.account(ctx, true); err != nil {
			return download.Authorization{}, err
		}
		token, err = a.downloadToken(ctx, acct, key, validFor)
	}
	if err != nil {
		return download.Authorization{}, err
	}
	return download.Authorization{BucketName: acct.BucketName, FileKey: key, Token: token, DownloadURL: acct.DownloadURL}, nil
}

func (a *Authorizer) account(ctx context.Context, refresh bool) (account, error) {
	var cached account
	if refresh {
		_ = a.cache.Delete(ctx, accountKey)
	} else if found, err := a.cache.Get(ctx, accountKey, &cached); err == nil && found && cached.Token != "" {
		return cached, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.authURL, nil)
	if err != nil {
		return account{}, fmt.Errorf("build b2 account request: %w", err)
	}
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(a.keyID+":"+a.key)))
	var decoded authorizeAccountResponse
	if err := a.do(req, &decoded); err != nil {
		return account{}, fmt.Errorf("authorize b2 account: %w", err)
	}
	storage := decoded.APIInfo.StorageAPI
	if len(storage.Allowed.Buckets) == 0 {
		return account{}, errors.New("authorize b2 account: the application key is not restricted to a bucket")
	}
	acct := account{
		Token:       decoded.AuthorizationToken,
		BucketID:    storage.Allowed.Buckets[0].ID,
		BucketName:  storage.Allowed.Buckets[0].Name,
		APIURL:      strings.TrimSuffix(storage.APIURL, "/"),
		DownloadURL: storage.DownloadURL,
	}
	_ = a.cache.Set(ctx, accountKey, acct, accountTTL)
	return acct, nil
}

func (a *Authorizer) downloadToken(ctx context.Context, acct account, key string, validFor time.Duration) (string, error) {
	payload, err := json.Marshal(downloadAuthorizationRequest{BucketID: acct.BucketID, FileNamePrefix: key, ValidDurationInSeconds: int(validFor / time.Second)})
	if err != nil {
		return "", fmt.Errorf("encode b2 download authorization: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, acct.APIURL+"/b2api/v4/b2_get_download_authorization", bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("build b2 download authorization: %w", err)
	}
	req.Header.Set("Authorization", acct.Token)
	req.Header.Set("Content-Type", "application/json")
	var decoded downloadAuthorizationResponse
	if err := a.do(req, &decoded); err != nil {
		return "", fmt.Errorf("get b2 download authorization: %w", err)
	}
	if decoded.AuthorizationToken == "" {
		return "", errors.New("get b2 download authorization: empty token")
	}
	return decoded.AuthorizationToken, nil
}

func (a *Authorizer) do(req *http.Request, target any) error {
	resp, err := a.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return errUnauthorized
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}
