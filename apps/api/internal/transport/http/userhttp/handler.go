package userhttp

import (
	"context"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/mediahttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	throttleAuth      = "auth"
	passwordPolicyKey = "validation.user.PASSWORD_MATCHES"
)

var tags = []string{"user"}

type Handler struct {
	service *user.Service
	edits   *user.EditHistoryService
	resp    *response.Builder
}

func NewHandler(service *user.Service, edits *user.EditHistoryService, resp *response.Builder) *Handler {
	return &Handler{service: service, edits: edits, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "user.register", Method: http.MethodPost, Path: "/user", Summary: "Register an account", Tags: tags, Throttle: throttleAuth}, h.register)
	httpapi.Register(api, httpapi.Route{ID: "user.me", Method: http.MethodGet, Path: "/user/me", Summary: "Get the caller's account", Tags: tags, Access: httpapi.AccessUser}, h.me)
	httpapi.Register(api, httpapi.Route{ID: "user.profile", Method: http.MethodGet, Path: "/user/{id}", Summary: "Get a public profile", Tags: tags}, h.profile)
	httpapi.Register(api, httpapi.Route{ID: "user.checkName", Method: http.MethodPost, Path: "/user/check-name", Summary: "Check whether a user name is taken", Tags: tags}, h.checkName)
	httpapi.Register(api, httpapi.Route{ID: "user.ban", Method: http.MethodPost, Path: "/user/{id}/ban", Summary: "Ban a user", Tags: tags, Access: httpapi.AccessAdmin}, h.ban)
	httpapi.Register(api, httpapi.Route{ID: "user.unban", Method: http.MethodPost, Path: "/user/{id}/unban", Summary: "Lift a ban", Tags: tags, Access: httpapi.AccessAdmin}, h.unban)
	httpapi.Register(api, httpapi.Route{ID: "user.info.avatar", Method: http.MethodPost, Path: "/user/info/avatar", Summary: "Upload an avatar", Tags: tags, Access: httpapi.AccessUser, MaxBodyBytes: mediahttp.BodyLimit(media.ProfileImageMaxBytes)}, h.avatar)
	httpapi.Register(api, httpapi.Route{ID: "user.info.cover", Method: http.MethodPost, Path: "/user/info/cover", Summary: "Upload a profile cover", Tags: tags, Access: httpapi.AccessUser, MaxBodyBytes: mediahttp.BodyLimit(media.ProfileImageMaxBytes)}, h.cover)
	httpapi.Register(api, httpapi.Route{ID: "user.info.bio", Method: http.MethodPost, Path: "/user/info/bio", Summary: "Update the bio", Tags: tags, Access: httpapi.AccessUser}, h.bio)
	httpapi.Register(api, httpapi.Route{ID: "user.info.name", Method: http.MethodPost, Path: "/user/info/name", Summary: "Rename the account", Tags: tags, Access: httpapi.AccessUser}, h.name)
	httpapi.Register(api, httpapi.Route{ID: "user.info.emailCode", Method: http.MethodPost, Path: "/user/info/email/request", Summary: "Email a code to the current address", Tags: tags, Access: httpapi.AccessUser, Throttle: throttleAuth}, h.emailCode)
	httpapi.Register(api, httpapi.Route{ID: "user.info.email", Method: http.MethodPost, Path: "/user/info/email", Summary: "Change the email address", Tags: tags, Access: httpapi.AccessUser, Throttle: throttleAuth}, h.email)
	httpapi.Register(api, httpapi.Route{ID: "user.info.password", Method: http.MethodPost, Path: "/user/info/password", Summary: "Change the password", Tags: tags, Access: httpapi.AccessUser, Throttle: throttleAuth}, h.password)
	httpapi.Register(api, httpapi.Route{ID: "user.info.lang", Method: http.MethodPost, Path: "/user/info/lang", Summary: "Change the preferred language", Tags: tags, Access: httpapi.AccessUser}, h.lang)
	httpapi.Register(api, httpapi.Route{ID: "user.info.contentLimit", Method: http.MethodPost, Path: "/user/info/content-limit", Summary: "Change the content limit", Tags: tags, Access: httpapi.AccessUser}, h.contentLimit)
	httpapi.Register(api, httpapi.Route{ID: "user.info.onlyGamesWithResources", Method: http.MethodPost, Path: "/user/info/only-games-with-resources", Summary: "Only list games with download resources", Tags: tags, Access: httpapi.AccessUser}, h.onlyGamesWithResources)
	httpapi.Register(api, httpapi.Route{ID: "user.editRecords", Method: http.MethodGet, Path: "/user/datas/{id}/edit-records", Summary: "List a user's catalog edits", Tags: tags}, h.editRecords)
}

func (h *Handler) register(ctx context.Context, in *registerUserInput) (*response.Output[registeredUserDTO], error) {
	if !user.MeetsPasswordPolicy(in.Body.Password) {
		return nil, apperror.ErrValidationFailed.WithField("password", h.resp.Translate(ctx, passwordPolicyKey, nil))
	}
	var lang *user.Lang
	if in.Body.Lang != nil {
		value := user.Lang(*in.Body.Lang)
		lang = &value
	}
	created, err := h.service.Register(ctx, user.RegisterInput{
		Name:           in.Body.Name,
		Email:          in.Body.Email,
		Password:       in.Body.Password,
		Lang:           lang,
		Code:           in.Body.Code,
		CodeID:         in.Body.UUID,
		AcceptLanguage: in.AcceptLanguage,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, registeredUserDTO{ID: created.ID, Name: created.Name, Email: created.Email, Role: int(created.Role), Created: created.Created}), nil
}

func (h *Handler) me(ctx context.Context, _ *struct{}) (*response.Output[userMeDTO], error) {
	me, err := h.service.Me(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toMeDTO(me, h.resp.Now())), nil
}

func (h *Handler) profile(ctx context.Context, in *userPathInput) (*response.Output[userProfileDTO], error) {
	profile, err := h.service.Profile(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toProfileDTO(profile, h.resp.Now())), nil
}

func (h *Handler) checkName(ctx context.Context, in *checkUserNameInput) (*response.Output[userNameCheckDTO], error) {
	taken, err := h.service.NameTaken(ctx, in.Body.Name)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, userNameCheckDTO{Exists: taken}), nil
}

func (h *Handler) ban(ctx context.Context, in *banUserInput) (*response.EmptyOutput, error) {
	admin := actor.From(ctx).UserID
	err := h.service.Ban(ctx, in.ID, user.BanInput{
		BannedBy:       &admin,
		Reason:         in.Body.BannedReason,
		DurationDays:   in.Body.BannedDurationDays,
		Permanent:      in.Body.IsPermanent != nil && *in.Body.IsPermanent,
		DeleteComments: in.Body.DeleteUserComments != nil && *in.Body.DeleteUserComments,
	})
	if err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) unban(ctx context.Context, in *userPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Unban(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) avatar(ctx context.Context, in *avatarUploadInput) (*response.Output[mediahttp.UploadedImageDTO], error) {
	upload, err := mediahttp.ReadUpload(in.RawBody.Data().Avatar, media.ProfileImageMaxBytes)
	if err != nil {
		return nil, err
	}
	key, err := h.service.UpdateAvatar(ctx, actor.From(ctx), upload)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, mediahttp.UploadedImageDTO{Key: key}), nil
}

func (h *Handler) cover(ctx context.Context, in *coverUploadInput) (*response.Output[mediahttp.UploadedImageDTO], error) {
	upload, err := mediahttp.ReadUpload(in.RawBody.Data().Cover, media.ProfileImageMaxBytes)
	if err != nil {
		return nil, err
	}
	key, err := h.service.UpdateCover(ctx, actor.From(ctx), upload)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, mediahttp.UploadedImageDTO{Key: key}), nil
}

func (h *Handler) bio(ctx context.Context, in *updateBioInput) (*response.Output[userBioDTO], error) {
	if err := h.service.UpdateBio(ctx, actor.From(ctx), in.Body.Bio); err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, userBioDTO{Bio: in.Body.Bio}), nil
}

func (h *Handler) name(ctx context.Context, in *updateNameInput) (*response.Output[userNameDTO], error) {
	if err := h.service.UpdateName(ctx, actor.From(ctx), in.Body.Name); err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, userNameDTO{Name: in.Body.Name}), nil
}

func (h *Handler) emailCode(ctx context.Context, _ *struct{}) (*response.Output[emailCodeDTO], error) {
	id, err := h.service.RequestEmailChangeCode(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, emailCodeDTO{UUID: id}), nil
}

func (h *Handler) email(ctx context.Context, in *updateEmailInput) (*response.EmptyOutput, error) {
	err := h.service.ChangeEmail(ctx, actor.From(ctx), user.EmailChange{
		Email:       in.Body.Email,
		CurrentID:   in.Body.CurrentUUID,
		CurrentCode: in.Body.CurrentCode,
		NewID:       in.Body.NewUUID,
		NewCode:     in.Body.NewCode,
	})
	if err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) password(ctx context.Context, in *updatePasswordInput) (*response.EmptyOutput, error) {
	if err := h.service.ChangePassword(ctx, actor.From(ctx), in.Body.Password, in.Body.OldPassword); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) lang(ctx context.Context, in *updateLangInput) (*response.EmptyOutput, error) {
	if err := h.service.UpdateLang(ctx, actor.From(ctx), user.Lang(in.Body.Lang)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) contentLimit(ctx context.Context, in *updateContentLimitInput) (*response.EmptyOutput, error) {
	if err := h.service.UpdateContentLimit(ctx, actor.From(ctx), actor.ContentLimit(in.Body.ContentLimit)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) onlyGamesWithResources(ctx context.Context, in *updateOnlyGamesWithResourcesInput) (*response.EmptyOutput, error) {
	if err := h.service.UpdateOnlyGamesWithResources(ctx, actor.From(ctx), in.Body.OnlyGamesWithResources); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) editRecords(ctx context.Context, in *editRecordsInput) (*response.Output[response.Page[editRecordDTO]], error) {
	records, total, err := h.edits.List(ctx, actor.From(ctx), in.ID, user.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(records, total, in.PageSize, in.Page, toEditRecordDTO)), nil
}

func ToUserSummary(s user.Summary, now time.Time) UserSummaryDTO {
	return UserSummaryDTO{ID: s.ID, Name: s.Name, Avatar: s.Avatar, IsSponsor: s.IsSponsor(now)}
}

func ToUserSummaryPtr(s *user.Summary, now time.Time) *UserSummaryDTO {
	if s == nil {
		return nil
	}
	summary := ToUserSummary(*s, now)
	return &summary
}
