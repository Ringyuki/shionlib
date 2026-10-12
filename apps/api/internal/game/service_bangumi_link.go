package game

import (
	"context"
	"strings"
)

type BangumiLinkService struct {
	bangumi     BangumiAuthorizer
	states      BangumiStates
	callbackURL string
	newState    func() string
}

func NewBangumiLinkService(bangumi BangumiAuthorizer, states BangumiStates, siteURL string, newState func() string) *BangumiLinkService {
	return &BangumiLinkService{bangumi: bangumi, states: states, callbackURL: strings.TrimSuffix(siteURL, "/") + bangumiCallbackPath, newState: newState}
}

func (s *BangumiLinkService) Status(ctx context.Context) (BangumiAuthorization, error) {
	authorization, err := s.bangumi.Authorization(ctx)
	if err != nil {
		return BangumiAuthorization{}, err
	}
	authorization.CallbackURL = s.callbackURL
	return authorization, nil
}

func (s *BangumiLinkService) Start(ctx context.Context, returnTo string) (string, error) {
	state := s.newState()
	authorizeURL, configured := s.bangumi.AuthorizeURL(s.callbackURL, state)
	if !configured {
		return "", ErrBangumiNotConfigured
	}
	if err := s.states.Save(ctx, state, bangumiReturnPath(returnTo), BangumiStateTTL); err != nil {
		return "", err
	}
	return authorizeURL, nil
}

func (s *BangumiLinkService) Complete(ctx context.Context, state, code string) (string, error) {
	if state == "" {
		return "", ErrBangumiAuthorizationInvalid
	}
	returnTo, known, err := s.states.Take(ctx, state)
	if err != nil {
		return "", err
	}
	if !known {
		return "", ErrBangumiAuthorizationInvalid
	}
	if code == "" {
		return returnTo, ErrBangumiAuthorizationInvalid
	}
	if err := s.bangumi.Exchange(ctx, code, s.callbackURL); err != nil {
		return returnTo, err
	}
	return returnTo, nil
}
