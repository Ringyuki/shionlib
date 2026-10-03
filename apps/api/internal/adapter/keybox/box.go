package keybox

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

const (
	minSecretLength = 32
	version         = "v1:"
)

var (
	ErrSecretTooShort = errors.New("keybox secret must be at least 32 bytes")
	ErrMalformed      = errors.New("sealed value is malformed")
)

type Box struct {
	aead cipher.AEAD
}

func NewBox(secret string) (*Box, error) {
	if len(secret) < minSecretLength {
		return nil, ErrSecretTooShort
	}
	key := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm: %w", err)
	}
	return &Box{aead: aead}, nil
}

func (b *Box) Seal(plain string) (string, error) {
	nonce := make([]byte, b.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	sealed := b.aead.Seal(nonce, nonce, []byte(plain), nil)
	return version + base64.StdEncoding.EncodeToString(sealed), nil
}

func (b *Box) Open(sealed string) (string, error) {
	encoded, ok := strings.CutPrefix(sealed, version)
	if !ok {
		return "", ErrMalformed
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(raw) < b.aead.NonceSize() {
		return "", ErrMalformed
	}
	nonce, ciphertext := raw[:b.aead.NonceSize()], raw[b.aead.NonceSize():]
	plain, err := b.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("open sealed value: %w", err)
	}
	return string(plain), nil
}
