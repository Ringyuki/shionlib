package auth

import (
	"encoding/json"
	"time"
)

const MaxPasskeyNameLength = 128

type Passkey struct {
	ID           int
	UserID       int
	CredentialID string
	PublicKey    string
	Counter      int
	Transports   []string
	AAGUID       *string
	DeviceType   *string
	BackedUp     bool
	Name         *string
	LastUsedAt   *time.Time
	Created      time.Time
}

type NewPasskey struct {
	UserID       int
	CredentialID string
	PublicKey    string
	Counter      int
	Transports   []string
	AAGUID       *string
	DeviceType   string
	BackedUp     bool
	Name         *string
	LastUsedAt   time.Time
}

type PasskeyUse struct {
	Counter    int
	DeviceType string
	BackedUp   bool
	At         time.Time
}

type PasskeyOwner struct {
	UserID      int
	Name        string
	DisplayName string
}

type PasskeyChallenge struct {
	Options json.RawMessage
	State   []byte
}

type RegisteredPasskey struct {
	CredentialID string
	PublicKey    string
	Counter      int
	Transports   []string
	AAGUID       *string
	DeviceType   string
	BackedUp     bool
}

type PasskeyAssertion struct {
	Counter    int
	DeviceType string
	BackedUp   bool
}
