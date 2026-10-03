package downloadtest

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Recorder struct {
	mu         sync.Mutex
	activities []activity.NewActivity
	messages   []message.NewMessage
	jobs       []download.Job
	EnqueueErr error
}

func (r *Recorder) Record(_ context.Context, in activity.NewActivity) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.activities = append(r.activities, in)
	return nil
}

func (r *Recorder) Send(_ context.Context, in message.NewMessage) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.messages = append(r.messages, in)
	return nil
}

func (r *Recorder) Enqueue(_ context.Context, job download.Job) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.EnqueueErr != nil {
		return r.EnqueueErr
	}
	r.jobs = append(r.jobs, job)
	return nil
}

func (r *Recorder) Activities() []activity.NewActivity {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.activities)
}

func (r *Recorder) Messages() []message.NewMessage {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.messages)
}

func (r *Recorder) Jobs() []download.Job {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.jobs)
}

type ObjectStore struct {
	mu       sync.Mutex
	Objects  map[string]download.Object
	Deleted  []string
	Purged   map[string]time.Time
	PutErr   error
	Listing  download.Listing
	failures map[string]error
}

func NewObjectStore() *ObjectStore {
	return &ObjectStore{Objects: map[string]download.Object{}, Purged: map[string]time.Time{}, failures: map[string]error{}}
}

func (s *ObjectStore) FailDelete(key string, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failures[key] = err
}

func (s *ObjectStore) Put(_ context.Context, object download.Object) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.PutErr != nil {
		return s.PutErr
	}
	s.Objects[object.Key] = object
	return nil
}

func (s *ObjectStore) Delete(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.failures[key]; err != nil {
		return err
	}
	s.Deleted = append(s.Deleted, key)
	delete(s.Objects, key)
	return nil
}

func (s *ObjectStore) DeleteVersionsBefore(_ context.Context, key string, before time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.failures[key]; err != nil {
		return err
	}
	s.Purged[key] = before
	return nil
}

func (s *ObjectStore) List(context.Context) (download.Listing, error) {
	return s.Listing, nil
}

type Challenge struct {
	Verdict download.Verdict
	Tokens  []string
}

func (c *Challenge) Verify(_ context.Context, token string) (download.Verdict, error) {
	c.Tokens = append(c.Tokens, token)
	return c.Verdict, nil
}

type AuthorizeCall struct {
	Key      string
	ValidFor time.Duration
}

type Authorizer struct {
	Calls []AuthorizeCall
}

func (a *Authorizer) Authorize(_ context.Context, key string, validFor time.Duration) (download.Authorization, error) {
	a.Calls = append(a.Calls, AuthorizeCall{Key: key, ValidFor: validFor})
	return download.Authorization{BucketName: "bucket", FileKey: key, Token: "dl-token", DownloadURL: "https://f005.backblazeb2.com"}, nil
}

type Sealer struct {
	Tickets []download.Ticket
}

func (s *Sealer) Seal(ticket download.Ticket) (string, error) {
	s.Tickets = append(s.Tickets, ticket)
	return "sealed.ticket+/=", nil
}
