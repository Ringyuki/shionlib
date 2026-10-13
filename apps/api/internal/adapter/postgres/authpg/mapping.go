package authpg

import (
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

func toPasskey(row *ent.UserPasskeyCredential) auth.Passkey {
	transports := slices.Clone([]string(row.Transports))
	if transports == nil {
		transports = []string{}
	}
	return auth.Passkey{
		ID:           row.ID,
		UserID:       row.UserID,
		CredentialID: row.CredentialID,
		PublicKey:    row.PublicKey,
		Counter:      row.Counter,
		Transports:   transports,
		AAGUID:       row.Aaguid,
		DeviceType:   row.DeviceType,
		BackedUp:     row.CredentialBackedUp,
		Name:         row.Name,
		LastUsedAt:   row.LastUsedAt,
		Created:      row.Created,
	}
}

func toIdentity(row *ent.OidcIdentity) auth.Identity {
	return auth.Identity{
		ID:          row.ID,
		UserID:      row.UserID,
		Provider:    row.Provider,
		Subject:     row.Subject,
		EmailAtLink: row.EmailAtLink,
		LastLoginAt: row.LastLoginAt,
		Created:     row.Created,
	}
}

func toSession(row *ent.UserLoginSession) auth.Session {
	return auth.Session{
		ID:          row.ID,
		UserID:      row.UserID,
		RefreshHash: row.RefreshTokenHash,
		Prefix:      row.RefreshTokenPrefix,
		Status:      auth.SessionStatus(row.Status),
		FamilyID:    row.FamilyID,
		ExpiresAt:   row.ExpiresAt,
		Created:     row.Created,
	}
}
