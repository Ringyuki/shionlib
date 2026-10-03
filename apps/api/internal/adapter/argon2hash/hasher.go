package argon2hash

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	saltBytes = 16
	keyBytes  = 32
	version   = argon2.Version
)

var encoding = base64.RawStdEncoding

type Params struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
}

func PasswordParams() Params {
	return Params{Memory: 65536, Iterations: 3, Parallelism: 4}
}

func RefreshTokenParams() Params {
	return Params{Memory: 19456, Iterations: 2, Parallelism: 1}
}

type Hasher struct {
	params Params
}

func New(params Params) *Hasher {
	return &Hasher{params: params}
}

func (h *Hasher) Hash(secret string) (string, error) {
	salt := make([]byte, saltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	key := argon2.IDKey([]byte(secret), salt, h.params.Iterations, h.params.Memory, h.params.Parallelism, keyBytes)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", version, h.params.Memory, h.params.Iterations, h.params.Parallelism, encoding.EncodeToString(salt), encoding.EncodeToString(key)), nil
}

func (h *Hasher) Verify(encoded, secret string) (bool, error) {
	parsed, err := parse(encoded)
	if err != nil {
		return false, err
	}
	derive := argon2.IDKey
	if parsed.variant == "argon2i" {
		derive = argon2.Key
	}
	key := derive([]byte(secret), parsed.salt, parsed.iterations, parsed.memory, parsed.parallelism, uint32(len(parsed.key)))
	return subtle.ConstantTimeCompare(key, parsed.key) == 1, nil
}

type phc struct {
	variant     string
	memory      uint32
	iterations  uint32
	parallelism uint8
	salt        []byte
	key         []byte
}

func parse(encoded string) (phc, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" {
		return phc{}, errors.New("argon2: malformed hash")
	}
	out := phc{variant: parts[1]}
	if out.variant != "argon2id" && out.variant != "argon2i" {
		return phc{}, fmt.Errorf("argon2: unsupported variant %q", out.variant)
	}
	if parts[2] != "v="+strconv.Itoa(version) {
		return phc{}, fmt.Errorf("argon2: unsupported version %q", parts[2])
	}
	for _, param := range strings.Split(parts[3], ",") {
		name, raw, ok := strings.Cut(param, "=")
		if !ok {
			return phc{}, errors.New("argon2: malformed parameters")
		}
		value, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			return phc{}, fmt.Errorf("argon2: parameter %s: %w", name, err)
		}
		switch name {
		case "m":
			out.memory = uint32(value)
		case "t":
			out.iterations = uint32(value)
		case "p":
			if value > 255 {
				return phc{}, errors.New("argon2: parallelism out of range")
			}
			out.parallelism = uint8(value)
		}
	}
	if out.memory == 0 || out.iterations == 0 || out.parallelism == 0 {
		return phc{}, errors.New("argon2: missing parameters")
	}
	var err error
	if out.salt, err = encoding.DecodeString(parts[4]); err != nil {
		return phc{}, fmt.Errorf("argon2: salt: %w", err)
	}
	if out.key, err = encoding.DecodeString(parts[5]); err != nil || len(out.key) == 0 {
		return phc{}, errors.New("argon2: malformed key")
	}
	return out, nil
}
