package passkey

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

const (
	deviceMulti  = "multiDevice"
	deviceSingle = "singleDevice"
)

var errCloned = errors.New("passkey counter did not increase")

type Settings struct {
	RPID    string
	RPName  string
	Origins []string
	Timeout time.Duration
}

type Ceremony struct {
	web *webauthn.WebAuthn
}

func New(settings Settings) (*Ceremony, error) {
	timeout := webauthn.TimeoutConfig{Timeout: settings.Timeout, TimeoutUVD: settings.Timeout}
	web, err := webauthn.New(&webauthn.Config{
		RPID:                  settings.RPID,
		RPDisplayName:         settings.RPName,
		RPOrigins:             settings.Origins,
		AttestationPreference: protocol.PreferNoAttestation,
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			ResidentKey:        protocol.ResidentKeyRequirementPreferred,
			RequireResidentKey: protocol.ResidentKeyNotRequired(),
			UserVerification:   protocol.VerificationRequired,
		},
		Timeouts:                          webauthn.TimeoutsConfig{Login: timeout, Registration: timeout},
		ExtensionsUnsolicitedOutputPolicy: protocol.UnsolicitedOutputPolicyIgnore,
	})
	if err != nil {
		return nil, fmt.Errorf("configure webauthn: %w", err)
	}
	return &Ceremony{web: web}, nil
}

func (c *Ceremony) BeginRegistration(owner auth.PasskeyOwner, exclude []auth.Passkey) (auth.PasskeyChallenge, error) {
	descriptors, err := descriptorsOf(exclude)
	if err != nil {
		return auth.PasskeyChallenge{}, err
	}
	creation, session, err := c.web.BeginRegistration(
		account{owner: owner},
		webauthn.WithExclusions(descriptors),
		webauthn.WithExtensions(webauthn.WithExtensionCredProps()),
	)
	if err != nil {
		return auth.PasskeyChallenge{}, err
	}
	return challengeOf(creation.Response, session)
}

func (c *Ceremony) FinishRegistration(owner auth.PasskeyOwner, state []byte, response json.RawMessage) (auth.RegisteredPasskey, error) {
	session, err := sessionOf(state)
	if err != nil {
		return auth.RegisteredPasskey{}, err
	}
	parsed, err := protocol.ParseCredentialCreationResponseBytes(response)
	if err != nil {
		return auth.RegisteredPasskey{}, fmt.Errorf("parse registration response: %w", err)
	}
	credential, err := c.web.CreateCredential(account{owner: owner}, session, parsed)
	if err != nil {
		return auth.RegisteredPasskey{}, fmt.Errorf("verify registration: %w", err)
	}
	transports := make([]string, 0, len(credential.Transport))
	for _, transport := range credential.Transport {
		transports = append(transports, string(transport))
	}
	registered := auth.RegisteredPasskey{
		CredentialID: base64.RawURLEncoding.EncodeToString(credential.ID),
		PublicKey:    base64.RawURLEncoding.EncodeToString(credential.PublicKey),
		Counter:      int(credential.Authenticator.SignCount),
		Transports:   transports,
		DeviceType:   deviceType(credential.Flags.BackupEligible),
		BackedUp:     credential.Flags.BackupState,
	}
	if aaguid, err := uuid.FromBytes(credential.Authenticator.AAGUID); err == nil {
		value := aaguid.String()
		registered.AAGUID = &value
	}
	return registered, nil
}

func (c *Ceremony) BeginLogin(owner *auth.PasskeyOwner, allow []auth.Passkey) (auth.PasskeyChallenge, error) {
	required := webauthn.WithUserVerification(protocol.VerificationRequired)
	if owner == nil || len(allow) == 0 {
		assertion, session, err := c.web.BeginDiscoverableLogin(required)
		if err != nil {
			return auth.PasskeyChallenge{}, err
		}
		return challengeOf(assertion.Response, session)
	}
	credentials, err := credentialsOf(allow, nil)
	if err != nil {
		return auth.PasskeyChallenge{}, err
	}
	assertion, session, err := c.web.BeginLogin(account{owner: *owner, credentials: credentials}, required)
	if err != nil {
		return auth.PasskeyChallenge{}, err
	}
	return challengeOf(assertion.Response, session)
}

func (c *Ceremony) CredentialID(response json.RawMessage) (string, error) {
	var envelope struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(response, &envelope); err != nil {
		return "", fmt.Errorf("parse assertion: %w", err)
	}
	if envelope.ID == "" {
		return "", errors.New("assertion has no credential id")
	}
	return envelope.ID, nil
}

func (c *Ceremony) FinishLogin(state []byte, owner auth.PasskeyOwner, credentials []auth.Passkey, response json.RawMessage) (auth.PasskeyAssertion, error) {
	session, err := sessionOf(state)
	if err != nil {
		return auth.PasskeyAssertion{}, err
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(response)
	if err != nil {
		return auth.PasskeyAssertion{}, fmt.Errorf("parse assertion: %w", err)
	}
	stored, err := credentialsOf(credentials, parsed)
	if err != nil {
		return auth.PasskeyAssertion{}, err
	}
	user := account{owner: owner, credentials: stored}
	var credential *webauthn.Credential
	if len(session.UserID) == 0 {
		_, credential, err = c.web.ValidatePasskeyLogin(func(_, _ []byte) (webauthn.User, error) { return user, nil }, session, parsed)
	} else {
		credential, err = c.web.ValidateLogin(user, session, parsed)
	}
	if err != nil {
		return auth.PasskeyAssertion{}, fmt.Errorf("verify assertion: %w", err)
	}
	if credential.Authenticator.CloneWarning {
		return auth.PasskeyAssertion{}, errCloned
	}
	flags := parsed.Response.AuthenticatorData.Flags
	return auth.PasskeyAssertion{
		Counter:    int(credential.Authenticator.SignCount),
		DeviceType: deviceType(flags.HasBackupEligible()),
		BackedUp:   flags.HasBackupState(),
	}, nil
}

type account struct {
	owner       auth.PasskeyOwner
	credentials []webauthn.Credential
}

func (a account) WebAuthnID() []byte {
	return []byte(strconv.Itoa(a.owner.UserID))
}

func (a account) WebAuthnName() string {
	return a.owner.Name
}

func (a account) WebAuthnDisplayName() string {
	return a.owner.DisplayName
}

func (a account) WebAuthnCredentials() []webauthn.Credential {
	return a.credentials
}

func challengeOf(options any, session *webauthn.SessionData) (auth.PasskeyChallenge, error) {
	rawOptions, err := json.Marshal(options)
	if err != nil {
		return auth.PasskeyChallenge{}, fmt.Errorf("encode passkey options: %w", err)
	}
	state, err := json.Marshal(session)
	if err != nil {
		return auth.PasskeyChallenge{}, fmt.Errorf("encode passkey session: %w", err)
	}
	return auth.PasskeyChallenge{Options: rawOptions, State: state}, nil
}

func sessionOf(state []byte) (webauthn.SessionData, error) {
	var session webauthn.SessionData
	if err := json.Unmarshal(state, &session); err != nil {
		return webauthn.SessionData{}, fmt.Errorf("decode passkey session: %w", err)
	}
	return session, nil
}

func descriptorsOf(keys []auth.Passkey) ([]protocol.CredentialDescriptor, error) {
	descriptors := make([]protocol.CredentialDescriptor, 0, len(keys))
	for _, key := range keys {
		id, err := decode(key.CredentialID)
		if err != nil {
			return nil, err
		}
		descriptors = append(descriptors, protocol.CredentialDescriptor{Type: protocol.PublicKeyCredentialType, CredentialID: id, Transport: transportsOf(key.Transports)})
	}
	return descriptors, nil
}

func credentialsOf(keys []auth.Passkey, parsed *protocol.ParsedCredentialAssertionData) ([]webauthn.Credential, error) {
	credentials := make([]webauthn.Credential, 0, len(keys))
	for _, key := range keys {
		id, err := decode(key.CredentialID)
		if err != nil {
			return nil, err
		}
		publicKey, err := decode(key.PublicKey)
		if err != nil {
			return nil, err
		}
		eligible := key.DeviceType != nil && *key.DeviceType == deviceMulti
		if key.DeviceType == nil && parsed != nil {
			eligible = parsed.Response.AuthenticatorData.Flags.HasBackupEligible()
		}
		credentials = append(credentials, webauthn.Credential{
			ID:            id,
			PublicKey:     publicKey,
			Transport:     transportsOf(key.Transports),
			Flags:         webauthn.CredentialFlags{UserPresent: true, UserVerified: true, BackupEligible: eligible, BackupState: key.BackedUp},
			Authenticator: webauthn.Authenticator{SignCount: uint32(max(key.Counter, 0))},
		})
	}
	return credentials, nil
}

func transportsOf(values []string) []protocol.AuthenticatorTransport {
	transports := make([]protocol.AuthenticatorTransport, 0, len(values))
	for _, value := range values {
		if value != "" {
			transports = append(transports, protocol.AuthenticatorTransport(value))
		}
	}
	return transports
}

func decode(value string) ([]byte, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(value, "="))
	if err != nil {
		return nil, fmt.Errorf("decode base64url value: %w", err)
	}
	return raw, nil
}

func deviceType(backupEligible bool) string {
	if backupEligible {
		return deviceMulti
	}
	return deviceSingle
}
