package user

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
)

const (
	reasonPasswordChanged = "user_password_changed"
	reasonEmailChanged    = "user_email_changed"
	reasonBanned          = "user_banned"
	emailChangeCodeTTL    = 30 * time.Minute
)

type Policy struct {
	AllowRegister bool
}

type Service struct {
	repo      Repository
	tx        Transactor
	sessions  SessionRevoker
	codes     VerificationCodes
	passwords PasswordHasher
	images    Images
	now       func() time.Time
	policy    Policy
}

func NewService(repo Repository, tx Transactor, sessions SessionRevoker, codes VerificationCodes, passwords PasswordHasher, images Images, now func() time.Time, policy Policy) *Service {
	return &Service{repo: repo, tx: tx, sessions: sessions, codes: codes, passwords: passwords, images: images, now: now, policy: policy}
}

type RegisterInput struct {
	Name           string
	Email          string
	Password       string
	Lang           *Lang
	Code           string
	CodeID         string
	AcceptLanguage string
}

func (s *Service) Register(ctx context.Context, in RegisterInput) (User, error) {
	if err := s.codes.Check(ctx, in.CodeID, in.Email, in.Code); err != nil {
		return User{}, err
	}
	lang := PreferredLang(in.AcceptLanguage)
	if in.Lang != nil && *in.Lang != "" {
		lang = *in.Lang
	}
	if !s.policy.AllowRegister {
		return User{}, ErrNotAllowRegister
	}
	if _, found, err := s.repo.FindByEmail(ctx, in.Email); err != nil {
		return User{}, err
	} else if found {
		return User{}, ErrEmailAlreadyExists
	}
	if taken, err := s.repo.NameExists(ctx, in.Name); err != nil {
		return User{}, err
	} else if taken {
		return User{}, ErrNameAlreadyExists
	}
	hash, err := s.passwords.Hash(in.Password)
	if err != nil {
		return User{}, fmt.Errorf("hash password: %w", err)
	}
	if err := s.codes.Consume(ctx, in.CodeID, in.Email); err != nil {
		return User{}, err
	}
	verifiedAt := s.now()
	var created User
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		created, err = s.repo.Create(ctx, NewUser{
			Name:            in.Name,
			Email:           in.Email,
			PasswordHash:    &hash,
			Lang:            lang,
			ContentLimit:    actor.ContentLimitNeverShow,
			EmailVerifiedAt: &verifiedAt,
		})
		return err
	})
	return created, err
}

func (s *Service) Me(ctx context.Context, who actor.Actor) (User, error) {
	return s.repo.Get(ctx, who.UserID)
}

func (s *Service) Profile(ctx context.Context, id int) (Profile, error) {
	found, err := s.repo.Get(ctx, id)
	if err != nil {
		return Profile{}, err
	}
	stats, err := s.repo.Stats(ctx, id)
	if err != nil {
		return Profile{}, err
	}
	return Profile{User: found, Stats: stats}, nil
}

func (s *Service) NameTaken(ctx context.Context, name string) (bool, error) {
	return s.repo.NameExists(ctx, name)
}

func (s *Service) UpdateBio(ctx context.Context, who actor.Actor, bio string) error {
	return s.repo.Update(ctx, who.UserID, Changes{Bio: &bio})
}

func (s *Service) UpdateName(ctx context.Context, who actor.Actor, name string) error {
	if err := s.ensureExists(ctx, who.UserID); err != nil {
		return err
	}
	if taken, err := s.repo.NameExists(ctx, name); err != nil {
		return err
	} else if taken {
		return ErrNameAlreadyExists
	}
	return s.repo.Update(ctx, who.UserID, Changes{Name: &name})
}

func (s *Service) UpdateLang(ctx context.Context, who actor.Actor, lang Lang) error {
	if !lang.Valid() {
		return ErrInvalidLang
	}
	return s.repo.Update(ctx, who.UserID, Changes{Lang: &lang})
}

func (s *Service) UpdateContentLimit(ctx context.Context, who actor.Actor, limit actor.ContentLimit) error {
	if !limit.Valid() {
		return ErrInvalidContentLimit
	}
	return s.repo.Update(ctx, who.UserID, Changes{ContentLimit: &limit})
}

func (s *Service) UpdateOnlyGamesWithResources(ctx context.Context, who actor.Actor, enabled bool) error {
	return s.repo.Update(ctx, who.UserID, Changes{OnlyGamesWithResources: &enabled})
}

func (s *Service) RequestEmailChangeCode(ctx context.Context, who actor.Actor) (string, error) {
	current, err := s.repo.Get(ctx, who.UserID)
	if err != nil {
		return "", err
	}
	return s.codes.Request(ctx, current.Email, emailChangeCodeTTL)
}

type EmailChange struct {
	Email       string
	CurrentID   string
	CurrentCode string
	NewID       string
	NewCode     string
}

func (s *Service) ChangeEmail(ctx context.Context, who actor.Actor, in EmailChange) error {
	current, err := s.repo.Get(ctx, who.UserID)
	if err != nil {
		return err
	}
	if err := s.codes.Check(ctx, in.CurrentID, current.Email, in.CurrentCode); err != nil {
		return err
	}
	if err := s.codes.Check(ctx, in.NewID, in.Email, in.NewCode); err != nil {
		return err
	}
	if owner, found, err := s.repo.FindByEmail(ctx, in.Email); err != nil {
		return err
	} else if found && owner.ID != current.ID {
		return ErrEmailAlreadyExists
	}
	if err := s.codes.Consume(ctx, in.CurrentID, current.Email); err != nil {
		return err
	}
	if err := s.codes.Consume(ctx, in.NewID, in.Email); err != nil {
		return err
	}
	verifiedAt := s.now()
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.repo.Update(ctx, current.ID, Changes{Email: &in.Email, EmailVerifiedAt: &verifiedAt}); err != nil {
			return err
		}
		return s.sessions.RevokeUser(ctx, current.ID, reasonEmailChanged)
	})
}

func (s *Service) ChangePassword(ctx context.Context, who actor.Actor, password, oldPassword string) error {
	current, err := s.repo.Get(ctx, who.UserID)
	if err != nil {
		return err
	}
	if !current.HasPassword() {
		return ErrInvalidPassword
	}
	ok, err := s.passwords.Verify(*current.PasswordHash, oldPassword)
	if err != nil {
		return fmt.Errorf("verify password: %w", err)
	}
	if !ok {
		return ErrInvalidPassword
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.repo.Update(ctx, current.ID, Changes{PasswordHash: &hash}); err != nil {
			return err
		}
		return s.sessions.RevokeUser(ctx, current.ID, reasonPasswordChanged)
	})
}

func (s *Service) UpdateAvatar(ctx context.Context, who actor.Actor, upload *media.Upload) (string, error) {
	return s.updateImage(ctx, who, upload, s.images.StoreAvatar, func(key string) Changes { return Changes{Avatar: &key} })
}

func (s *Service) UpdateCover(ctx context.Context, who actor.Actor, upload *media.Upload) (string, error) {
	return s.updateImage(ctx, who, upload, s.images.StoreCover, func(key string) Changes { return Changes{Cover: &key} })
}

func (s *Service) updateImage(ctx context.Context, who actor.Actor, upload *media.Upload, store func(context.Context, int, *media.Upload) (string, error), changes func(string) Changes) (string, error) {
	if err := s.ensureExists(ctx, who.UserID); err != nil {
		return "", err
	}
	key, err := store(ctx, who.UserID, upload)
	if err != nil {
		return "", err
	}
	if err := s.repo.Update(ctx, who.UserID, changes(key)); err != nil {
		return "", err
	}
	return key, nil
}

func (s *Service) ensureExists(ctx context.Context, id int) error {
	_, err := s.repo.Get(ctx, id)
	return err
}
