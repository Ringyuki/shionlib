package dlticket

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

var _ download.TicketSealer = (*Sealer)(nil)

const (
	vectorSecret    = "test-download-ticket-secret"
	vectorIV        = "000102030405060708090a0b"
	nodeTicket      = "AAECAwQFBgcICQoL.BqgLOEVG2jhhP8NMxnD6WsOANXPwVuXYMEyIx0-RaF9m6H1nQoXxd_k4sOIwCUcDqE88Y9n9npaGEplFqvU5J-KWXMXhM9wGpa2Y0jTVC9ade-MgPuFO4sZuJ-lfKGoY9hQBerKpswU8NHPQj-4O4GVPoZjrQYzKTiX24ZeFA5EMWSf5FQqmvaTa0cpLt1EU0blO5xKzplDp5-ux9N7P74Y_X-09QlfBb2XgxJjavflIE2UF-aFJORbysL5CECgYl2gMss8vMAh3yn3VV8lchuFVOupUwqecs7QsPqu_nZ5BWNlsN2DakfQrSQFmpsT3IQLyt0g4diqu-CHbGqjVW9YgcqtM2_XQDfN_xE9V7s8.qegkYohsTkM7qS3gdHcIkA"
	nodePlaintext   = `{"v":3,"sid":"5f0c3c1e-8a4e-4a39-9a8c-0d2c6c1d8f42","fid":123,"n":"ゲーム & <体験版> \"v1\".7z","exp":1760000000,"hx":1760082800,"mc":8,"b":"game-bucket","k":"games/12/123/ゲーム_体験版.7z","a":"3_20260101_token/+=","u":"https://f005.backblazeb2.com","gid":12}`
	workerTicketVer = 3
)

var vectorTicket = download.Ticket{
	Version:     3,
	SessionID:   "5f0c3c1e-8a4e-4a39-9a8c-0d2c6c1d8f42",
	FileID:      123,
	FileName:    `ゲーム & <体験版> "v1".7z`,
	Expires:     1760000000,
	HardExpires: 1760082800,
	MaxConns:    8,
	Bucket:      "game-bucket",
	Key:         "games/12/123/ゲーム_体験版.7z",
	Token:       "3_20260101_token/+=",
	DownloadURL: "https://f005.backblazeb2.com",
	GameID:      12,
}

func TestSealMatchesTheNodeImplementationByteForByte(t *testing.T) {
	iv, err := hex.DecodeString(vectorIV)
	if err != nil {
		t.Fatal(err)
	}
	plaintext, err := encode(vectorTicket)
	if err != nil {
		t.Fatal(err)
	}
	if string(plaintext) != nodePlaintext {
		t.Fatalf("payload differs from JSON.stringify:\n got %s\nwant %s", plaintext, nodePlaintext)
	}
	sealed, err := NewSealer(vectorSecret).sealWithIV(vectorTicket, iv)
	if err != nil {
		t.Fatal(err)
	}
	if sealed != nodeTicket {
		t.Fatalf("ticket differs from the Node implementation:\n got %s\nwant %s", sealed, nodeTicket)
	}
}

func TestOpenReadsNodeTickets(t *testing.T) {
	opened, err := NewSealer(vectorSecret).Open(nodeTicket)
	if err != nil {
		t.Fatal(err)
	}
	if opened != vectorTicket {
		t.Fatalf("got %+v", opened)
	}
	if _, err := NewSealer("other-secret").Open(nodeTicket); !errors.Is(err, ErrInvalidTicket) {
		t.Fatalf("wrong secret: %v", err)
	}
	for _, broken := range []string{"", "a.b", "a.b.c.d", nodeTicket[:len(nodeTicket)-2], strings.Replace(nodeTicket, "B", "C", 1)} {
		if _, err := NewSealer(vectorSecret).Open(broken); err == nil {
			t.Fatalf("tampered ticket %q must not open", broken)
		}
	}
}

func TestSealedTicketsDecryptWithWorkerRules(t *testing.T) {
	sealer := NewSealer(vectorSecret)
	first, err := sealer.Seal(vectorTicket)
	if err != nil {
		t.Fatal(err)
	}
	second, err := sealer.Seal(vectorTicket)
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("every ticket must use a fresh IV")
	}
	decoded := workerDecrypt(t, first, vectorSecret)
	if decoded["v"] != float64(workerTicketVer) || decoded["sid"] != vectorTicket.SessionID || decoded["fid"] != float64(123) || decoded["hx"] != float64(1760082800) || decoded["n"] != vectorTicket.FileName {
		t.Fatalf("worker view %v", decoded)
	}
}

func TestMissingSecret(t *testing.T) {
	if _, err := NewSealer("").Seal(vectorTicket); !errors.Is(err, download.ErrTicketSecretMissing) {
		t.Fatalf("got %v", err)
	}
}

func workerDecrypt(t *testing.T, ticket, secret string) map[string]any {
	t.Helper()
	parts := strings.Split(ticket, ".")
	if len(parts) != 3 {
		t.Fatalf("ticket has %d parts", len(parts))
	}
	decode := func(value string) []byte {
		normalized := strings.NewReplacer("-", "+", "_", "/").Replace(value)
		if rem := len(normalized) % 4; rem != 0 {
			normalized += strings.Repeat("=", 4-rem)
		}
		raw, err := base64.StdEncoding.DecodeString(normalized)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}
	iv, ciphertext, tag := decode(parts[0]), decode(parts[1]), decode(parts[2])
	key := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		t.Fatal(err)
	}
	aead, err := cipher.NewGCMWithTagSize(block, 16)
	if err != nil {
		t.Fatal(err)
	}
	plaintext, err := aead.Open(nil, iv, append(ciphertext, tag...), nil)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		t.Fatal(err)
	}
	return payload
}
