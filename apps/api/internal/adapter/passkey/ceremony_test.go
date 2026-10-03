package passkey

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

const (
	origin = "https://shionlib.example"
	rpID   = "shionlib.example"
)

var b64 = base64.RawURLEncoding

type authenticator struct {
	key     *ecdsa.PrivateKey
	id      []byte
	counter uint32
	handle  []byte
}

func newAuthenticator(t *testing.T, userID string) *authenticator {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	id := make([]byte, 16)
	_, _ = rand.Read(id)
	return &authenticator{key: key, id: id, handle: []byte(userID)}
}

func (a *authenticator) cose(t *testing.T) []byte {
	t.Helper()
	raw, err := webauthncbor.Marshal(map[int]any{1: 2, 3: -7, -1: 1, -2: a.key.X.FillBytes(make([]byte, 32)), -3: a.key.Y.FillBytes(make([]byte, 32))})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func (a *authenticator) authData(t *testing.T, attested bool) []byte {
	t.Helper()
	rp := sha256.Sum256([]byte(rpID))
	flags := byte(0x01 | 0x04 | 0x08 | 0x10)
	if attested {
		flags |= 0x40
	}
	data := append(rp[:], flags)
	data = binary.BigEndian.AppendUint32(data, a.counter)
	if attested {
		data = append(data, make([]byte, 16)...)
		data = binary.BigEndian.AppendUint16(data, uint16(len(a.id)))
		data = append(data, a.id...)
		data = append(data, a.cose(t)...)
	}
	return data
}

func challengeFrom(t *testing.T, options json.RawMessage) string {
	t.Helper()
	var decoded struct {
		Challenge string `json:"challenge"`
	}
	if err := json.Unmarshal(options, &decoded); err != nil {
		t.Fatal(err)
	}
	return decoded.Challenge
}

func clientData(kind, challenge string) []byte {
	raw, _ := json.Marshal(map[string]any{"type": kind, "challenge": challenge, "origin": origin, "crossOrigin": false})
	return raw
}

func (a *authenticator) register(t *testing.T, options json.RawMessage) json.RawMessage {
	t.Helper()
	attestation, err := webauthncbor.Marshal(map[string]any{"fmt": "none", "attStmt": map[string]any{}, "authData": a.authData(t, true)})
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(map[string]any{
		"id": b64.EncodeToString(a.id), "rawId": b64.EncodeToString(a.id), "type": "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64.EncodeToString(clientData("webauthn.create", challengeFrom(t, options))),
			"attestationObject": b64.EncodeToString(attestation),
			"transports":        []string{"internal", "hybrid"},
		},
		"clientExtensionResults": map[string]any{"credProps": map[string]any{"rk": true}},
	})
	return raw
}

func (a *authenticator) assert(t *testing.T, options json.RawMessage) json.RawMessage {
	t.Helper()
	a.counter++
	data := a.authData(t, false)
	client := clientData("webauthn.get", challengeFrom(t, options))
	digest := sha256.Sum256(client)
	signed := sha256.Sum256(append(append([]byte{}, data...), digest[:]...))
	signature, err := ecdsa.SignASN1(rand.Reader, a.key, signed[:])
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(map[string]any{
		"id": b64.EncodeToString(a.id), "rawId": b64.EncodeToString(a.id), "type": "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64.EncodeToString(client),
			"authenticatorData": b64.EncodeToString(data),
			"signature":         b64.EncodeToString(signature),
			"userHandle":        b64.EncodeToString(a.handle),
		},
		"clientExtensionResults": map[string]any{},
	})
	return raw
}

func newCeremony(t *testing.T) *Ceremony {
	t.Helper()
	ceremony, err := New(Settings{RPID: rpID, RPName: "Shionlib", Origins: []string{origin}, Timeout: time.Minute})
	if err != nil {
		t.Fatal(err)
	}
	return ceremony
}

func stored(registered auth.RegisteredPasskey, userID int) auth.Passkey {
	deviceType := registered.DeviceType
	return auth.Passkey{ID: 1, UserID: userID, CredentialID: registered.CredentialID, PublicKey: registered.PublicKey, Counter: registered.Counter, Transports: registered.Transports, DeviceType: &deviceType, BackedUp: registered.BackedUp}
}

func TestRegistrationOptionsMatchTheLegacyShape(t *testing.T) {
	ceremony := newCeremony(t)
	owner := auth.PasskeyOwner{UserID: 42, Name: "alice@example.test", DisplayName: "alice"}
	existing := auth.Passkey{CredentialID: b64.EncodeToString([]byte("old")), Transports: []string{"usb"}}
	challenge, err := ceremony.BeginRegistration(owner, []auth.Passkey{existing})
	if err != nil {
		t.Fatal(err)
	}
	var options struct {
		RP   struct{ ID, Name string } `json:"rp"`
		User struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			DisplayName string `json:"displayName"`
		} `json:"user"`
		Attestation string `json:"attestation"`
		Exclude     []struct {
			ID         string   `json:"id"`
			Transports []string `json:"transports"`
		} `json:"excludeCredentials"`
		Selection struct {
			ResidentKey      string `json:"residentKey"`
			UserVerification string `json:"userVerification"`
		} `json:"authenticatorSelection"`
		Extensions map[string]any `json:"extensions"`
	}
	if err := json.Unmarshal(challenge.Options, &options); err != nil {
		t.Fatal(err)
	}
	if options.RP.ID != rpID || options.User.ID != b64.EncodeToString([]byte("42")) || options.User.Name != "alice@example.test" || options.User.DisplayName != "alice" {
		t.Fatalf("unexpected entities %s", challenge.Options)
	}
	if options.Attestation != "none" || options.Selection.ResidentKey != "preferred" || options.Selection.UserVerification != "required" || options.Extensions["credProps"] != true {
		t.Fatalf("unexpected policy %s", challenge.Options)
	}
	if len(options.Exclude) != 1 || options.Exclude[0].ID != existing.CredentialID || options.Exclude[0].Transports[0] != "usb" {
		t.Fatalf("unexpected exclusions %s", challenge.Options)
	}
}

func TestRegisterThenLogin(t *testing.T) {
	ceremony := newCeremony(t)
	owner := auth.PasskeyOwner{UserID: 42, Name: "alice@example.test", DisplayName: "alice"}
	device := newAuthenticator(t, "42")

	challenge, err := ceremony.BeginRegistration(owner, nil)
	if err != nil {
		t.Fatal(err)
	}
	registered, err := ceremony.FinishRegistration(owner, challenge.State, device.register(t, challenge.Options))
	if err != nil {
		t.Fatal(err)
	}
	if registered.CredentialID != b64.EncodeToString(device.id) || registered.DeviceType != "multiDevice" || !registered.BackedUp || registered.AAGUID == nil || *registered.AAGUID != "00000000-0000-0000-0000-000000000000" || len(registered.Transports) != 2 {
		t.Fatalf("unexpected registration %+v", registered)
	}
	if _, err := b64.DecodeString(registered.PublicKey); err != nil {
		t.Fatalf("public keys are stored as unpadded base64url: %v", err)
	}
	other := auth.PasskeyOwner{UserID: 7}
	if _, err := ceremony.FinishRegistration(other, challenge.State, device.register(t, challenge.Options)); err == nil {
		t.Fatal("a registration for another user must fail")
	}

	key := stored(registered, 42)
	discoverable, err := ceremony.BeginLogin(nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	response := device.assert(t, discoverable.Options)
	if id, err := ceremony.CredentialID(response); err != nil || id != key.CredentialID {
		t.Fatalf("credential id: %s %v", id, err)
	}
	assertion, err := ceremony.FinishLogin(discoverable.State, owner, []auth.Passkey{key}, response)
	if err != nil {
		t.Fatal(err)
	}
	if assertion.Counter != 1 || assertion.DeviceType != "multiDevice" || !assertion.BackedUp {
		t.Fatalf("unexpected assertion %+v", assertion)
	}
	key.Counter = assertion.Counter

	scoped, err := ceremony.BeginLogin(&owner, []auth.Passkey{key})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ceremony.FinishLogin(scoped.State, owner, []auth.Passkey{key}, device.assert(t, scoped.Options)); err != nil {
		t.Fatalf("identifier login: %v", err)
	}

	replay, _ := ceremony.BeginLogin(nil, nil)
	device.counter = 0
	if _, err := ceremony.FinishLogin(replay.State, owner, []auth.Passkey{{CredentialID: key.CredentialID, PublicKey: key.PublicKey, Counter: 5, DeviceType: key.DeviceType, BackedUp: true}}, device.assert(t, replay.Options)); err == nil {
		t.Fatal("a counter regression must be rejected")
	}
	stale, _ := ceremony.BeginLogin(nil, nil)
	if _, err := ceremony.FinishLogin(stale.State, owner, []auth.Passkey{key}, device.assert(t, discoverable.Options)); err == nil {
		t.Fatal("an assertion over another challenge must be rejected")
	}
	impostor := auth.PasskeyOwner{UserID: 7}
	again, _ := ceremony.BeginLogin(nil, nil)
	if _, err := ceremony.FinishLogin(again.State, impostor, []auth.Passkey{key}, device.assert(t, again.Options)); err == nil {
		t.Fatal("the user handle must match the credential owner")
	}
}
