package dlticket

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const (
	ivSize  = 12
	tagSize = 16
)

var ErrInvalidTicket = errors.New("invalid download ticket")

type payload struct {
	V   int    `json:"v"`
	Sid string `json:"sid"`
	Fid int    `json:"fid"`
	N   string `json:"n"`
	Exp int64  `json:"exp"`
	Hx  int64  `json:"hx"`
	Mc  int    `json:"mc"`
	B   string `json:"b"`
	K   string `json:"k"`
	A   string `json:"a"`
	U   string `json:"u"`
	Gid int    `json:"gid"`
}

type Sealer struct {
	secret string
}

func NewSealer(secret string) *Sealer {
	return &Sealer{secret: secret}
}

func (s *Sealer) Seal(ticket download.Ticket) (string, error) {
	iv := make([]byte, ivSize)
	if _, err := rand.Read(iv); err != nil {
		return "", fmt.Errorf("generate ticket iv: %w", err)
	}
	return s.sealWithIV(ticket, iv)
}

func (s *Sealer) sealWithIV(ticket download.Ticket, iv []byte) (string, error) {
	aead, err := s.aead()
	if err != nil {
		return "", err
	}
	plaintext, err := encode(ticket)
	if err != nil {
		return "", err
	}
	sealed := aead.Seal(nil, iv, plaintext, nil)
	ciphertext, tag := sealed[:len(sealed)-tagSize], sealed[len(sealed)-tagSize:]
	return strings.Join([]string{encodePart(iv), encodePart(ciphertext), encodePart(tag)}, "."), nil
}

func (s *Sealer) Open(ticket string) (download.Ticket, error) {
	aead, err := s.aead()
	if err != nil {
		return download.Ticket{}, err
	}
	parts := strings.Split(ticket, ".")
	if len(parts) != 3 {
		return download.Ticket{}, ErrInvalidTicket
	}
	var raw [3][]byte
	for i, part := range parts {
		if raw[i], err = base64.RawURLEncoding.DecodeString(part); err != nil || len(raw[i]) == 0 {
			return download.Ticket{}, ErrInvalidTicket
		}
	}
	if len(raw[0]) != ivSize || len(raw[2]) != tagSize {
		return download.Ticket{}, ErrInvalidTicket
	}
	plaintext, err := aead.Open(nil, raw[0], append(raw[1], raw[2]...), nil)
	if err != nil {
		return download.Ticket{}, fmt.Errorf("%w: %w", ErrInvalidTicket, err)
	}
	var decoded payload
	if err := json.Unmarshal(plaintext, &decoded); err != nil || decoded.V != download.TicketVersion {
		return download.Ticket{}, ErrInvalidTicket
	}
	return download.Ticket{
		Version:     decoded.V,
		SessionID:   decoded.Sid,
		FileID:      decoded.Fid,
		FileName:    decoded.N,
		Expires:     decoded.Exp,
		HardExpires: decoded.Hx,
		MaxConns:    decoded.Mc,
		Bucket:      decoded.B,
		Key:         decoded.K,
		Token:       decoded.A,
		DownloadURL: decoded.U,
		GameID:      decoded.Gid,
	}, nil
}

func (s *Sealer) aead() (cipher.AEAD, error) {
	if s.secret == "" {
		return nil, download.ErrTicketSecretMissing
	}
	key := sha256.Sum256([]byte(s.secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("create ticket cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create ticket aead: %w", err)
	}
	return aead, nil
}

func encode(ticket download.Ticket) ([]byte, error) {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(payload{
		V:   ticket.Version,
		Sid: ticket.SessionID,
		Fid: ticket.FileID,
		N:   ticket.FileName,
		Exp: ticket.Expires,
		Hx:  ticket.HardExpires,
		Mc:  ticket.MaxConns,
		B:   ticket.Bucket,
		K:   ticket.Key,
		A:   ticket.Token,
		U:   ticket.DownloadURL,
		Gid: ticket.GameID,
	}); err != nil {
		return nil, fmt.Errorf("encode ticket: %w", err)
	}
	return bytes.TrimSuffix(buf.Bytes(), []byte("\n")), nil
}

func encodePart(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}
