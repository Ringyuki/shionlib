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
	return fmt.Sprintf("access:%d:%d:%s:%d", claims.UserID, claims.SessionID, claims.FamilyID, claims.ExpiresAt.Unix()), nil
}

func (Codec) Verify(token string) (auth.AccessClaims, error) {
	var (
		claims  auth.AccessClaims
		expires int64
	)
	parts := strings.Split(token, ":")
	if len(parts) != 5 || parts[0] != "access" {
		return auth.AccessClaims{}, errors.New("malformed access token")
	}
	if _, err := fmt.Sscan(parts[1], &claims.UserID); err != nil {
		return auth.AccessClaims{}, err
	}
	if _, err := fmt.Sscan(parts[2], &claims.SessionID); err != nil {
		return auth.AccessClaims{}, err
	}
	if _, err := fmt.Sscan(parts[4], &expires); err != nil {
		return auth.AccessClaims{}, err
	}
	claims.FamilyID = parts[3]
	claims.ExpiresAt = time.Unix(expires, 0).UTC()
	return claims, nil
}

type Standings struct {
	mu     sync.Mutex
	known  map[int]auth.Standing
	Fail   error
	Lookup int
}

func NewStandings() *Standings {
	return &Standings{known: map[int]auth.Standing{}}
}

func (s *Standings) Set(userID int, standing auth.Standing) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.known[userID] = standing
}

func (s *Standings) Remove(userID int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.known, userID)
}

func (s *Standings) Standing(_ context.Context, userID int) (auth.Standing, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Lookup++
	if s.Fail != nil {
		return auth.Standing{}, false, s.Fail
	}
	standing, ok := s.known[userID]
	return standing, ok, nil
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
