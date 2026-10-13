package potatovntest

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

type Client struct {
	mu          sync.Mutex
	Accounts    map[string]string
	Galgames    []potatovn.Galgame
	PageSize    int
	Saved       []potatovn.GalgameDraft
	Removed     []int
	Reserved    []string
	Uploaded    []string
	Committed   []string
	FailLibrary error
	FailRefresh error
	FailUpload  error
	FailRemove  error
	NextID      int
	Expires     time.Time
}

func NewClient() *Client {
	return &Client{Accounts: map[string]string{}, PageSize: 50, NextID: 1000, Expires: time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)}
}

func (c *Client) Login(_ context.Context, userName, password string) (potatovn.Session, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if expected, ok := c.Accounts[userName]; !ok || expected != password {
		return potatovn.Session{}, potatovn.ErrBindingAuthFailed
	}
	return potatovn.Session{UserID: 77, UserName: "Canonical" + userName, Token: "token-" + userName, Expires: c.Expires}, nil
}

func (c *Client) Refresh(_ context.Context, token string) (potatovn.Session, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.FailRefresh != nil {
		return potatovn.Session{}, c.FailRefresh
	}
	return potatovn.Session{Token: token + "-refreshed", Expires: c.Expires}, nil
}

func (c *Client) Library(_ context.Context, _ string, pageIndex, pageSize int) (potatovn.LibraryPage, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.FailLibrary != nil {
		return potatovn.LibraryPage{}, c.FailLibrary
	}
	size := min(pageSize, c.PageSize)
	start := min(pageIndex*size, len(c.Galgames))
	end := min(start+size, len(c.Galgames))
	pages := (len(c.Galgames) + size - 1) / size
	return potatovn.LibraryPage{Items: c.Galgames[start:end], PageCount: pages}, nil
}

func (c *Client) SaveGalgame(_ context.Context, _ string, draft potatovn.GalgameDraft) (potatovn.Galgame, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Saved = append(c.Saved, draft)
	c.NextID++
	return potatovn.Galgame{ID: c.NextID, TotalPlayTime: 30, Sessions: []potatovn.PlaySession{
		{At: time.Unix(1700000000, 0).UTC(), Minutes: 10},
		{At: time.Unix(1700086400, 0).UTC(), Minutes: 20},
	}, PlayType: 1, MyRate: 8}, nil
}

func (c *Client) RemoveGalgame(_ context.Context, _ string, galgameID int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.FailRemove != nil {
		return c.FailRemove
	}
	c.Removed = append(c.Removed, galgameID)
	return nil
}

func (c *Client) ReserveImage(_ context.Context, _, objectName string, size int) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if size <= 0 {
		return "", errors.New("empty image")
	}
	c.Reserved = append(c.Reserved, objectName)
	return "https://oss.example/" + objectName, nil
}

func (c *Client) UploadImage(_ context.Context, uploadURL string, _ potatovn.Cover) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.FailUpload != nil {
		return c.FailUpload
	}
	c.Uploaded = append(c.Uploaded, uploadURL)
	return nil
}

func (c *Client) CommitImage(_ context.Context, _, objectName string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Committed = append(c.Committed, objectName)
	return nil
}

type Covers map[string]potatovn.Cover

func (c Covers) Fetch(_ context.Context, key string, _ int64) (potatovn.Cover, error) {
	cover, ok := c[key]
	if !ok {
		return potatovn.Cover{}, errors.New("missing cover")
	}
	return cover, nil
}

type Scheduler struct {
	mu   sync.Mutex
	Jobs []potatovn.SyncLibraryJob
	Fail error
}

func (s *Scheduler) Schedule(_ context.Context, job potatovn.SyncLibraryJob) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Fail != nil {
		return s.Fail
	}
	s.Jobs = append(s.Jobs, job)
	return nil
}
