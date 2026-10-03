package authtest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

var (
	errDuplicatePrefix = errors.New("duplicate refresh token prefix")
	errMissingSession  = errors.New("session not found")
	errMissingPasskey  = errors.New("passkey not found")
	errMissingIdentity = errors.New("identity not found")
)

type entry struct {
	value   []byte
	expires time.Time
}

type MemoryStore struct {
	mu      sync.Mutex
	now     func() time.Time
	entries map[string]entry
}

func NewMemoryStore(now func() time.Time) *MemoryStore {
	return &MemoryStore{now: now, entries: map[string]entry{}}
}

func (s *MemoryStore) Put(_ context.Context, key string, value []byte, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries[key] = entry{value: append([]byte(nil), value...), expires: s.now().Add(ttl)}
	return nil
}

func (s *MemoryStore) Get(_ context.Context, key string) ([]byte, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	value, ok := s.live(key)
	return value, ok, nil
}

func (s *MemoryStore) Take(_ context.Context, key string) ([]byte, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	value, ok := s.live(key)
	delete(s.entries, key)
	return value, ok, nil
}

func (s *MemoryStore) TTL(key string) (time.Duration, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	stored, ok := s.entries[key]
	if !ok {
		return 0, false
	}
	return stored.expires.Sub(s.now()), true
}

func (s *MemoryStore) Keys() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	keys := make([]string, 0, len(s.entries))
	for key := range s.entries {
		keys = append(keys, key)
	}
	return keys
}

func (s *MemoryStore) live(key string) ([]byte, bool) {
	stored, ok := s.entries[key]
	if !ok {
		return nil, false
	}
	if !stored.expires.After(s.now()) {
		delete(s.entries, key)
		return nil, false
	}
	return append([]byte(nil), stored.value...), true
}

type Hasher struct{}

func (Hasher) Hash(secret string) (string, error) {
	return "hash:" + secret, nil
}

func (Hasher) Verify(hash, secret string) (bool, error) {
	if !strings.HasPrefix(hash, "hash:") {
		return false, errors.New("malformed hash")
	}
	return hash == "hash:"+secret, nil
}

type Codec struct{}

func (Codec) Sign(claims auth.AccessClaims) (string, error) {
	return fmt.Sprintf("access:%d:%d:%s:%d:%d:%d", claims.UserID, claims.SessionID, claims.FamilyID, claims.Role, claims.ContentLimit, claims.ExpiresAt.Unix()), nil
}

func (Codec) Verify(string) (auth.AccessClaims, error) {
	return auth.AccessClaims{}, errors.New("not implemented")
}

type Blocklist struct {
	mu      sync.Mutex
	blocked map[string]time.Duration
}

func NewBlocklist() *Blocklist {
	return &Blocklist{blocked: map[string]time.Duration{}}
}

func (b *Blocklist) Blocked(_ context.Context, familyID string) (bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	_, ok := b.blocked[familyID]
	return ok, nil
}

func (b *Blocklist) Block(_ context.Context, familyID string, ttl time.Duration) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.blocked[familyID] = ttl
	return nil
}

func (b *Blocklist) TTL(familyID string) (time.Duration, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	ttl, ok := b.blocked[familyID]
	return ttl, ok
}

type Mail struct {
	To   string
	Kind string
	Body string
	TTL  time.Duration
}

type Mailer struct {
	mu   sync.Mutex
	Sent []Mail
	Fail error
}

func (m *Mailer) SendVerificationCode(_ context.Context, to, code string, ttl time.Duration) error {
	return m.record(Mail{To: to, Kind: "code", Body: code, TTL: ttl})
}

func (m *Mailer) SendPasswordReset(_ context.Context, to, link string, ttl time.Duration) error {
	return m.record(Mail{To: to, Kind: "reset", Body: link, TTL: ttl})
}

func (m *Mailer) record(mail Mail) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.Fail != nil {
		return m.Fail
	}
	m.Sent = append(m.Sent, mail)
	return nil
}

func (m *Mailer) Last() Mail {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.Sent) == 0 {
		return Mail{}
	}
	return m.Sent[len(m.Sent)-1]
}

type ceremonyState struct {
	Kind   string `json:"kind"`
	UserID int    `json:"user_id"`
}

type assertion struct {
	ID      string `json:"id"`
	Counter int    `json:"counter"`
	Valid   bool   `json:"valid"`
}

type Ceremony struct {
	Registered auth.RegisteredPasskey
	FailFinish bool
}

func (c *Ceremony) BeginRegistration(owner auth.PasskeyOwner, exclude []auth.Passkey) (auth.PasskeyChallenge, error) {
	ids := make([]string, len(exclude))
	for i, p := range exclude {
		ids[i] = p.CredentialID
	}
	options, _ := json.Marshal(map[string]any{"user": owner.Name, "exclude": ids})
	state, _ := json.Marshal(ceremonyState{Kind: "register", UserID: owner.UserID})
	return auth.PasskeyChallenge{Options: options, State: state}, nil
}

func (c *Ceremony) FinishRegistration(owner auth.PasskeyOwner, state []byte, _ json.RawMessage) (auth.RegisteredPasskey, error) {
	var decoded ceremonyState
	if err := json.Unmarshal(state, &decoded); err != nil || decoded.UserID != owner.UserID || c.FailFinish {
		return auth.RegisteredPasskey{}, errors.New("registration rejected")
	}
	return c.Registered, nil
}

func (c *Ceremony) BeginLogin(owner *auth.PasskeyOwner, allow []auth.Passkey) (auth.PasskeyChallenge, error) {
	ids := make([]string, len(allow))
	for i, p := range allow {
		ids[i] = p.CredentialID
	}
	userID := 0
	if owner != nil {
		userID = owner.UserID
	}
	options, _ := json.Marshal(map[string]any{"allow": ids})
	state, _ := json.Marshal(ceremonyState{Kind: "login", UserID: userID})
	return auth.PasskeyChallenge{Options: options, State: state}, nil
}

func (c *Ceremony) CredentialID(response json.RawMessage) (string, error) {
	var decoded assertion
	if err := json.Unmarshal(response, &decoded); err != nil || decoded.ID == "" {
		return "", errors.New("malformed assertion")
	}
	return decoded.ID, nil
}

func (c *Ceremony) FinishLogin(state []byte, owner auth.PasskeyOwner, credentials []auth.Passkey, response json.RawMessage) (auth.PasskeyAssertion, error) {
	var decoded assertion
	if err := json.Unmarshal(response, &decoded); err != nil || !decoded.Valid {
		return auth.PasskeyAssertion{}, errors.New("assertion rejected")
	}
	var session ceremonyState
	if err := json.Unmarshal(state, &session); err != nil || (session.UserID != 0 && session.UserID != owner.UserID) {
		return auth.PasskeyAssertion{}, errors.New("session mismatch")
	}
	for _, credential := range credentials {
		if credential.CredentialID == decoded.ID {
			return auth.PasskeyAssertion{Counter: decoded.Counter, DeviceType: "multiDevice", BackedUp: true}, nil
		}
	}
	return auth.PasskeyAssertion{}, errors.New("credential not owned")
}

func Assertion(credentialID string, counter int, valid bool) json.RawMessage {
	raw, _ := json.Marshal(assertion{ID: credentialID, Counter: counter, Valid: valid})
	return raw
}

type IdentityProvider struct {
	mu        sync.Mutex
	Claims    auth.IdentityClaims
	Fail      error
	Exchanges []auth.CodeExchange
}

func (p *IdentityProvider) AuthorizeURL(req auth.AuthorizeRequest) string {
	return "https://id.example/auth?redirect_uri=" + req.RedirectURI + "&state=" + req.State + "&code_challenge=" + req.CodeChallenge + "&nonce=" + req.Nonce
}

func (p *IdentityProvider) Exchange(_ context.Context, req auth.CodeExchange) (auth.IdentityClaims, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Exchanges = append(p.Exchanges, req)
	if p.Fail != nil {
		return auth.IdentityClaims{}, p.Fail
	}
	return p.Claims, nil
}
