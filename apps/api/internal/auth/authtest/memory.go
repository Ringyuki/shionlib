package authtest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

type storedSession struct {
	auth.Session
	replacedBy   *int
	rotatedAt    *time.Time
	reusedAt     *time.Time
	blockedAt    *time.Time
	blockReason  string
	lastUsedAt   time.Time
	ip           *string
	userAgent    *string
	insertionSeq int
}

type MemoryRepository struct {
	mu         sync.Mutex
	now        func() time.Time
	nextID     int
	sessions   map[int]*storedSession
	passkeys   map[int]auth.Passkey
	revoked    map[int]time.Time
	identities map[int]auth.Identity
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:        now,
		sessions:   map[int]*storedSession{},
		passkeys:   map[int]auth.Passkey{},
		revoked:    map[int]time.Time{},
		identities: map[int]auth.Identity{},
	}
}

func (r *MemoryRepository) id() int {
	r.nextID++
	return r.nextID
}

func (r *MemoryRepository) Session(id int) (auth.Session, string, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.sessions[id]
	if !ok {
		return auth.Session{}, "", false
	}
	return stored.Session, stored.blockReason, true
}

func (r *MemoryRepository) Sessions() []auth.Session {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]auth.Session, 0, len(r.sessions))
	for _, stored := range r.sessions {
		out = append(out, stored.Session)
	}
	slices.SortFunc(out, func(a, b auth.Session) int { return cmp.Compare(a.ID, b.ID) })
	return out
}

func (r *MemoryRepository) SeedSession(s auth.Session) auth.Session {
	r.mu.Lock()
	defer r.mu.Unlock()
	s.ID = r.id()
	if s.Created.IsZero() {
		s.Created = r.now()
	}
	r.sessions[s.ID] = &storedSession{Session: s, insertionSeq: s.ID}
	return s
}

func (r *MemoryRepository) CreateSession(_ context.Context, in auth.NewSession) (auth.Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, existing := range r.sessions {
		if existing.Prefix == in.Prefix {
			return auth.Session{}, errDuplicatePrefix
		}
	}
	session := auth.Session{
		ID:          r.id(),
		UserID:      in.UserID,
		RefreshHash: in.RefreshHash,
		Prefix:      in.Prefix,
		Status:      auth.SessionActive,
		FamilyID:    in.FamilyID,
		ExpiresAt:   in.ExpiresAt,
		Created:     r.now(),
	}
	r.sessions[session.ID] = &storedSession{Session: session, lastUsedAt: in.LastUsedAt, ip: in.IP, userAgent: in.UserAgent, insertionSeq: session.ID}
	return session, nil
}

func (r *MemoryRepository) LockSessionByPrefix(ctx context.Context, prefix string) (auth.Session, bool, error) {
	return r.FindSessionByPrefix(ctx, prefix)
}

func (r *MemoryRepository) FindSessionByPrefix(_ context.Context, prefix string) (auth.Session, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, stored := range r.sessions {
		if stored.Prefix == prefix {
			return stored.Session, true, nil
		}
	}
	return auth.Session{}, false, nil
}

func (r *MemoryRepository) MarkSessionRotated(_ context.Context, id, replacedBy int, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.sessions[id]
	if !ok {
		return errMissingSession
	}
	stored.Status = auth.SessionRotated
	stored.replacedBy = &replacedBy
	stored.rotatedAt = &at
	stored.lastUsedAt = at
	return nil
}

func (r *MemoryRepository) MarkSessionReused(_ context.Context, id int, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.sessions[id]
	if !ok {
		return errMissingSession
	}
	stored.Status = auth.SessionReused
	stored.reusedAt = &at
	return nil
}

func (r *MemoryRepository) BlockFamily(_ context.Context, familyID string, statuses []auth.SessionStatus, reason string, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, stored := range r.sessions {
		if stored.FamilyID == familyID && slices.Contains(statuses, stored.Status) {
			r.block(stored, reason, at)
		}
	}
	return nil
}

func (r *MemoryRepository) BlockUserFamily(_ context.Context, userID int, familyID, reason string, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, stored := range r.sessions {
		if stored.UserID == userID && stored.FamilyID == familyID {
			r.block(stored, reason, at)
		}
	}
	return nil
}

func (r *MemoryRepository) BlockUserSessions(_ context.Context, userID int, reason string, at, liveSince time.Time) ([]auth.LiveFamily, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	live := map[string]auth.LiveFamily{}
	for _, stored := range r.sessions {
		if stored.UserID != userID {
			continue
		}
		if stored.Status == auth.SessionActive && stored.Created.After(liveSince) {
			family := live[stored.FamilyID]
			family.FamilyID = stored.FamilyID
			if stored.Created.After(family.Created) {
				family.Created = stored.Created
			}
			if stored.ExpiresAt.After(family.ExpiresAt) {
				family.ExpiresAt = stored.ExpiresAt
			}
			live[stored.FamilyID] = family
		}
		r.block(stored, reason, at)
	}
	out := make([]auth.LiveFamily, 0, len(live))
	for _, family := range live {
		out = append(out, family)
	}
	slices.SortFunc(out, func(a, b auth.LiveFamily) int { return cmp.Compare(a.FamilyID, b.FamilyID) })
	return out, nil
}

func (r *MemoryRepository) block(stored *storedSession, reason string, at time.Time) {
	stored.Status = auth.SessionBlocked
	stored.blockedAt = &at
	stored.blockReason = reason
}

func (r *MemoryRepository) FamilyStartedAt(_ context.Context, familyID string) (time.Time, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var first time.Time
	found := false
	for _, stored := range r.sessions {
		if stored.FamilyID == familyID && (!found || stored.Created.Before(first)) {
			first, found = stored.Created, true
		}
	}
	return first, found, nil
}

func (r *MemoryRepository) DeleteStaleSessions(_ context.Context, expiredBefore time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	deleted := 0
	for id, stored := range r.sessions {
		if stored.Status != auth.SessionActive && stored.ExpiresAt.Before(expiredBefore) {
			delete(r.sessions, id)
			deleted++
		}
	}
	return deleted, nil
}

func (r *MemoryRepository) SeedPasskey(p auth.Passkey) auth.Passkey {
	r.mu.Lock()
	defer r.mu.Unlock()
	p.ID = r.id()
	if p.Created.IsZero() {
		p.Created = r.now()
	}
	r.passkeys[p.ID] = p
	return p
}

func (r *MemoryRepository) Passkey(id int) (auth.Passkey, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.passkeys[id]
	_, revoked := r.revoked[id]
	return p, ok && !revoked
}

func (r *MemoryRepository) ActivePasskeys(_ context.Context, userID int) ([]auth.Passkey, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []auth.Passkey{}
	for id, p := range r.passkeys {
		if _, revoked := r.revoked[id]; !revoked && p.UserID == userID {
			out = append(out, p)
		}
	}
	slices.SortFunc(out, func(a, b auth.Passkey) int {
		if c := a.Created.Compare(b.Created); c != 0 {
			return c
		}
		return cmp.Compare(a.ID, b.ID)
	})
	return out, nil
}

func (r *MemoryRepository) FindActivePasskey(_ context.Context, credentialID string) (auth.Passkey, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, p := range r.passkeys {
		if _, revoked := r.revoked[id]; !revoked && p.CredentialID == credentialID {
			return p, true, nil
		}
	}
	return auth.Passkey{}, false, nil
}

func (r *MemoryRepository) CreatePasskey(_ context.Context, in auth.NewPasskey) (auth.Passkey, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, p := range r.passkeys {
		if p.CredentialID == in.CredentialID {
			return auth.Passkey{}, auth.ErrPasskeyExists
		}
	}
	deviceType := in.DeviceType
	lastUsed := in.LastUsedAt
	p := auth.Passkey{
		ID:           r.id(),
		UserID:       in.UserID,
		CredentialID: in.CredentialID,
		PublicKey:    in.PublicKey,
		Counter:      in.Counter,
		Transports:   nonNil(in.Transports),
		AAGUID:       in.AAGUID,
		DeviceType:   &deviceType,
		BackedUp:     in.BackedUp,
		Name:         in.Name,
		LastUsedAt:   &lastUsed,
		Created:      r.now(),
	}
	r.passkeys[p.ID] = p
	return p, nil
}

func (r *MemoryRepository) RecordPasskeyUse(_ context.Context, id int, use auth.PasskeyUse) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.passkeys[id]
	if !ok {
		return errMissingPasskey
	}
	deviceType, at := use.DeviceType, use.At
	p.Counter, p.DeviceType, p.BackedUp, p.LastUsedAt = use.Counter, &deviceType, use.BackedUp, &at
	r.passkeys[id] = p
	return nil
}

func (r *MemoryRepository) RevokePasskey(_ context.Context, id, userID int, at time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.passkeys[id]
	if _, revoked := r.revoked[id]; !ok || revoked || p.UserID != userID {
		return false, nil
	}
	r.revoked[id] = at
	return true, nil
}

func (r *MemoryRepository) CountActivePasskeys(ctx context.Context, userID int) (int, error) {
	keys, err := r.ActivePasskeys(ctx, userID)
	return len(keys), err
}

func (r *MemoryRepository) FindIdentity(_ context.Context, provider, subject string) (auth.Identity, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, identity := range r.identities {
		if identity.Provider == provider && identity.Subject == subject {
			return identity, true, nil
		}
	}
	return auth.Identity{}, false, nil
}

func (r *MemoryRepository) GetIdentity(_ context.Context, id int) (auth.Identity, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	identity, ok := r.identities[id]
	return identity, ok, nil
}

func (r *MemoryRepository) CreateIdentity(_ context.Context, in auth.NewIdentity) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, identity := range r.identities {
		if identity.Provider == in.Provider && identity.Subject == in.Subject {
			return auth.ErrIdentityExists
		}
	}
	at := in.LastLoginAt
	identity := auth.Identity{ID: r.id(), UserID: in.UserID, Provider: in.Provider, Subject: in.Subject, EmailAtLink: in.EmailAtLink, LastLoginAt: &at, Created: r.now()}
	r.identities[identity.ID] = identity
	return nil
}

func (r *MemoryRepository) TouchIdentity(_ context.Context, id int, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	identity, ok := r.identities[id]
	if !ok {
		return errMissingIdentity
	}
	identity.LastLoginAt = &at
	r.identities[id] = identity
	return nil
}

func (r *MemoryRepository) ListIdentities(_ context.Context, userID int) ([]auth.Identity, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []auth.Identity{}
	for _, identity := range r.identities {
		if identity.UserID == userID {
			out = append(out, identity)
		}
	}
	slices.SortFunc(out, func(a, b auth.Identity) int {
		if c := a.Created.Compare(b.Created); c != 0 {
			return c
		}
		return cmp.Compare(a.ID, b.ID)
	})
	return out, nil
}

func (r *MemoryRepository) CountIdentities(ctx context.Context, userID int) (int, error) {
	items, err := r.ListIdentities(ctx, userID)
	return len(items), err
}

func (r *MemoryRepository) DeleteIdentity(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.identities, id)
	return nil
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return slices.Clone(values)
}
