package hmacsign

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
)

type Signer struct {
	key []byte
}

func New(secret, purpose string) *Signer {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(purpose))
	return &Signer{key: mac.Sum(nil)}
}

func (s *Signer) Sign(message string) string {
	return base64.RawURLEncoding.EncodeToString(s.mac(message))
}

func (s *Signer) Verify(message, signature string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return false
	}
	return hmac.Equal(decoded, s.mac(message))
}

func (s *Signer) mac(message string) []byte {
	mac := hmac.New(sha256.New, s.key)
	mac.Write([]byte(message))
	return mac.Sum(nil)
}
