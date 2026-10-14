package indexing

import (
	"context"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Service struct {
	feed      ChangeFeed
	submitter Submitter
	cursor    Cursor
	settings  setting.Source
	siteURL   string
	key       string
	now       func() time.Time
}

type Options struct {
	SiteURL string
	Key     string
}

func NewService(feed ChangeFeed, submitter Submitter, cursor Cursor, settings setting.Source, options Options, now func() time.Time) *Service {
	return &Service{feed: feed, submitter: submitter, cursor: cursor, settings: settings, siteURL: options.SiteURL, key: options.Key, now: now}
}

func (s *Service) Key() string {
	return s.key
}

func (s *Service) Push(ctx context.Context) (int, error) {
	if !Enabled.Read(s.settings) {
		return 0, nil
	}
	since, found, err := s.cursor.Load(ctx)
	if err != nil {
		return 0, err
	}
	if !found {
		return 0, s.cursor.Save(ctx, s.now())
	}
	changes, err := s.feed.Changes(ctx, since, BatchLimit)
	if err != nil || len(changes) == 0 {
		return 0, err
	}
	urls := s.addressesOf(changes)
	for chunk := range slices.Chunk(urls, BatchLimit) {
		if err := s.submitter.Submit(ctx, chunk); err != nil {
			return 0, err
		}
	}
	latest := since
	for _, change := range changes {
		if change.At.After(latest) {
			latest = change.At
		}
	}
	return len(urls), s.cursor.Save(ctx, latest)
}

func (s *Service) addressesOf(changes []Change) []string {
	urls := []string{}
	seen := map[string]bool{}
	for _, change := range changes {
		for _, path := range change.Paths() {
			if url := s.siteURL + path; !seen[url] {
				seen[url] = true
				urls = append(urls, url)
			}
		}
	}
	return urls
}
