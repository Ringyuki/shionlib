package apikey

import (
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Deps struct {
	Repo     Repository
	Usage    UsageStore
	Counter  Counter
	Messages Messenger
	Tx       Transactor
	Settings setting.Source
	Random   io.Reader
	Now      func() time.Time
}

type Service struct {
	repo     Repository
	tx       Transactor
	settings setting.Source
	random   io.Reader
}

func NewService(deps Deps) *Service {
	random := deps.Random
	if random == nil {
		random = rand.Reader
	}
	return &Service{repo: deps.Repo, tx: deps.Tx, settings: deps.Settings, random: random}
}

func (s *Service) Mine(ctx context.Context, viewer actor.Actor) (Mine, error) {
	keys, err := s.repo.Mine(ctx, viewer.UserID)
	if err != nil {
		return Mine{}, err
	}
	return Mine{Keys: keys, Limit: MaxKeys.Read(s.settings), Enabled: Enabled.Read(s.settings)}, nil
}

func (s *Service) Create(ctx context.Context, viewer actor.Actor, name string) (Issued, error) {
	if !Enabled.Read(s.settings) {
		return Issued{}, ErrClosed
	}
	secret, err := s.newSecret()
	if err != nil {
		return Issued{}, err
	}
	var issued Issued
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		count, err := s.repo.CountMine(ctx, viewer.UserID)
		if err != nil {
			return err
		}
		if count >= MaxKeys.Read(s.settings) {
			return ErrTooManyKeys
		}
		key, err := s.repo.Create(ctx, NewKey{
			UserID:     viewer.UserID,
			Name:       strings.TrimSpace(name),
			Prefix:     secret[:ShownPrefixLength],
			SecretHash: hashOf(secret),
		})
		issued = Issued{Key: key, Secret: secret}
		return err
	})
	return issued, err
}

func (s *Service) Delete(ctx context.Context, viewer actor.Actor, id int) error {
	return s.repo.DeleteMine(ctx, viewer.UserID, id)
}

func (s *Service) newSecret() (string, error) {
	raw := make([]byte, SecretBytes)
	if _, err := io.ReadFull(s.random, raw); err != nil {
		return "", fmt.Errorf("generate an API key: %w", err)
	}
	encoded := new(big.Int).SetBytes(raw).Text(62)
	return SecretPrefix + strings.Repeat("0", secretLength-len(encoded)) + encoded, nil
}
