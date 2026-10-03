package auth

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var (
	ErrUnauthorized              = apperror.Define(200101, "AUTH_UNAUTHORIZED", apperror.KindUnauthenticated)
	ErrInvalidToken              = apperror.Define(200102, "AUTH_INVALID_TOKEN", apperror.KindUnauthenticated)
	ErrInvalidRefreshToken       = apperror.Define(200103, "AUTH_INVALID_REFRESH_TOKEN", apperror.KindUnauthenticated)
	ErrRefreshTokenExpired       = apperror.Define(200104, "AUTH_REFRESH_TOKEN_EXPIRED", apperror.KindUnauthenticated)
	ErrRefreshTokenReused        = apperror.Define(200105, "AUTH_REFRESH_TOKEN_REUSED", apperror.KindUnauthenticated)
	ErrFamilyBlocked             = apperror.Define(200106, "AUTH_FAMILY_BLOCKED", apperror.KindPermissionDenied)
	ErrVerificationCodeNotFound  = apperror.Define(200107, "AUTH_VERIFICATION_CODE_NOT_FOUND_OR_EXPIRED", apperror.KindUnauthenticated)
	ErrVerificationCodeMismatch  = apperror.Define(200108, "AUTH_VERIFICATION_CODE_ERROR", apperror.KindUnauthenticated)
	ErrInvalidResetPasswordToken = apperror.Define(200109, "AUTH_INVALID_RESET_PASSWORD_TOKEN", apperror.KindPermissionDenied)
	ErrForbidden                 = apperror.Define(200110, "AUTH_FORBIDDEN", apperror.KindPermissionDenied)
	ErrOIDCIdentityNotFound      = apperror.Define(200201, "AUTH_OIDC_IDENTITY_NOT_FOUND", apperror.KindNotFound)
	ErrOIDCLastLoginMethod       = apperror.Define(200202, "AUTH_OIDC_LAST_LOGIN_METHOD", apperror.KindInvalidArgument)
)

var ErrTokenExpired = errors.New("access token expired")
