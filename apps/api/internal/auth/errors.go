package auth

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrUnauthorized = apperror.Define(200101, "AUTH_UNAUTHORIZED", apperror.KindUnauthenticated)

var ErrInvalidToken = apperror.Define(200102, "AUTH_INVALID_TOKEN", apperror.KindUnauthenticated)

var ErrInvalidRefreshToken = apperror.Define(200103, "AUTH_INVALID_REFRESH_TOKEN", apperror.KindUnauthenticated)

var ErrRefreshTokenExpired = apperror.Define(200104, "AUTH_REFRESH_TOKEN_EXPIRED", apperror.KindUnauthenticated)

var ErrRefreshTokenReused = apperror.Define(200105, "AUTH_REFRESH_TOKEN_REUSED", apperror.KindUnauthenticated)

var ErrFamilyBlocked = apperror.Define(200106, "AUTH_FAMILY_BLOCKED", apperror.KindPermissionDenied)

var ErrVerificationCodeNotFound = apperror.Define(200107, "AUTH_VERIFICATION_CODE_NOT_FOUND_OR_EXPIRED", apperror.KindUnauthenticated)

var ErrVerificationCodeMismatch = apperror.Define(200108, "AUTH_VERIFICATION_CODE_ERROR", apperror.KindUnauthenticated)

var ErrInvalidResetPasswordToken = apperror.Define(200109, "AUTH_INVALID_RESET_PASSWORD_TOKEN", apperror.KindPermissionDenied)

var ErrForbidden = apperror.Define(200110, "AUTH_FORBIDDEN", apperror.KindPermissionDenied)

var ErrOIDCIdentityNotFound = apperror.Define(200201, "AUTH_OIDC_IDENTITY_NOT_FOUND", apperror.KindNotFound)

var ErrOIDCLastLoginMethod = apperror.Define(200202, "AUTH_OIDC_LAST_LOGIN_METHOD", apperror.KindInvalidArgument)

var ErrTokenExpired = errors.New("access token expired")

var ErrIdentityExists = errors.New("oidc identity already linked")

var ErrPasskeyExists = errors.New("passkey credential already registered")
