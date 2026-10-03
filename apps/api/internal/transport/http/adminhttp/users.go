package adminhttp

import (
	"context"
	"net/http"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const passwordPolicyKey = "validation.user.PASSWORD_MATCHES"

var tags = []string{"admin"}

type UserHandler struct {
	service *admin.UserService
	resp    *response.Builder
}

func NewUserHandler(service *admin.UserService, resp *response.Builder) *UserHandler {
	return &UserHandler{service: service, resp: resp}
}

func (h *UserHandler) Register(api *httpapi.API) {
	route := func(id, method, path, summary string) httpapi.Route {
		return httpapi.Route{ID: id, Method: method, Path: path, Summary: summary, Tags: tags, Access: httpapi.AccessAdmin}
	}
	httpapi.Register(api, route("adminUser.list", http.MethodGet, "/admin/users", "List users"), h.list)
	httpapi.Register(api, route("adminUser.get", http.MethodGet, "/admin/users/{id}", "Read a user"), h.get)
	httpapi.Register(api, route("adminUser.updateProfile", http.MethodPatch, "/admin/users/{id}/profile", "Edit a user's profile"), h.updateProfile)
	httpapi.Register(api, route("adminUser.setRole", http.MethodPatch, "/admin/users/{id}/role", "Change a user's role (super admins only)"), h.setRole)
	httpapi.Register(api, route("adminUser.ban", http.MethodPost, "/admin/users/{id}/ban", "Ban a user"), h.ban)
	httpapi.Register(api, route("adminUser.unban", http.MethodPost, "/admin/users/{id}/unban", "Lift a user's ban"), h.unban)
	httpapi.Register(api, route("adminUser.resetPassword", http.MethodPost, "/admin/users/{id}/reset-password", "Set a new password and end every session"), h.resetPassword)
	httpapi.Register(api, route("adminUser.forceLogout", http.MethodPost, "/admin/users/{id}/force-logout", "End every session of a user"), h.forceLogout)
	httpapi.Register(api, route("adminUser.sessions", http.MethodGet, "/admin/users/{id}/sessions", "List a user's login sessions"), h.sessions)
	httpapi.Register(api, route("adminUser.permissions", http.MethodGet, "/admin/users/{id}/permissions", "Read a user's edit permissions"), h.permissions)
	httpapi.Register(api, route("adminUser.setPermissions", http.MethodPatch, "/admin/users/{id}/permissions", "Replace a user's edit permissions"), h.setPermissions)
	httpapi.Register(api, route("adminUser.adjustQuotaSize", http.MethodPatch, "/admin/users/{id}/quota/size", "Grant or take upload quota"), h.adjustQuotaSize)
	httpapi.Register(api, route("adminUser.adjustQuotaUsed", http.MethodPatch, "/admin/users/{id}/quota/used", "Correct the used upload quota"), h.adjustQuotaUsed)
	httpapi.Register(api, route("adminUser.resetQuotaUsed", http.MethodPost, "/admin/users/{id}/quota/reset-used", "Reset the used upload quota"), h.resetQuotaUsed)
	httpapi.Register(api, route("adminUser.setSponsor", http.MethodPatch, "/admin/users/{id}/sponsor", "Set or clear the sponsor badge"), h.setSponsor)
}

func (h *UserHandler) list(ctx context.Context, in *adminUserListInput) (*response.Output[response.Page[adminUserItemDTO]], error) {
	entries, total, err := h.service.Search(ctx, in.filter(), admin.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, toAdminUserItem)), nil
}

func (h *UserHandler) get(ctx context.Context, in *adminUserPath) (*response.Output[adminUserDetailDTO], error) {
	detail, err := h.service.Detail(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminUserDetail(detail)), nil
}

func (h *UserHandler) updateProfile(ctx context.Context, in *adminUserProfileInput) (*response.Output[adminUserProfileDTO], error) {
	updated, changed, err := h.service.UpdateProfile(ctx, actor.From(ctx), in.ID, in.changes())
	if err != nil {
		return nil, err
	}
	out := adminUserProfileDTO{ID: updated.ID, Name: updated.Name, Email: updated.Email}
	if changed {
		lang, limit := string(updated.Lang), int(updated.ContentLimit)
		out.Lang, out.ContentLimit = &lang, &limit
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *UserHandler) setRole(ctx context.Context, in *adminUserRoleInput) (*response.EmptyOutput, error) {
	if err := h.service.SetRole(ctx, actor.From(ctx), in.ID, actor.Role(in.Body.Role)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *UserHandler) ban(ctx context.Context, in *adminUserBanInput) (*response.EmptyOutput, error) {
	err := h.service.Ban(ctx, actor.From(ctx), in.ID, user.BanInput{
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

func (h *UserHandler) unban(ctx context.Context, in *adminUserPath) (*response.EmptyOutput, error) {
	if err := h.service.Unban(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *UserHandler) resetPassword(ctx context.Context, in *adminUserPasswordInput) (*response.EmptyOutput, error) {
	if !user.MeetsPasswordPolicy(in.Body.Password) {
		return nil, apperror.ErrValidationFailed.WithField("password", h.resp.Translate(ctx, passwordPolicyKey, nil))
	}
	if err := h.service.ResetPassword(ctx, actor.From(ctx), in.ID, in.Body.Password); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *UserHandler) forceLogout(ctx context.Context, in *adminUserPath) (*response.EmptyOutput, error) {
	if err := h.service.ForceLogout(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *UserHandler) sessions(ctx context.Context, in *adminUserSessionsInput) (*response.Output[response.Page[adminUserSessionDTO]], error) {
	filter := admin.SessionFilter{UserID: in.ID}
	if in.Status != 0 {
		status := auth.SessionStatus(in.Status)
		filter.Status = &status
	}
	sessions, total, err := h.service.Sessions(ctx, filter, admin.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(sessions, total, in.PageSize, in.Page, toAdminUserSession)), nil
}

func (h *UserHandler) permissions(ctx context.Context, in *adminUserPermissionsInput) (*response.Output[adminUserPermissionsDTO], error) {
	view, err := h.service.Permissions(ctx, actor.From(ctx), in.ID, admin.PermissionEntity(in.Entity))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminUserPermissions(view)), nil
}

func (h *UserHandler) setPermissions(ctx context.Context, in *adminUserSetPermissionsInput) (*response.Output[adminUserAllowMaskDTO], error) {
	mask, err := h.service.SetPermissions(ctx, actor.From(ctx), in.ID, admin.PermissionEntity(in.Body.Entity), in.Body.AllowBits)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, adminUserAllowMaskDTO{AllowMask: strconv.FormatInt(mask, 10)}), nil
}

func (h *UserHandler) adjustQuotaSize(ctx context.Context, in *adminUserQuotaSizeInput) (*response.EmptyOutput, error) {
	change := admin.QuotaChange{Action: upload.QuotaAction(in.Body.Action), Amount: in.Body.Amount, Reason: deref(in.Body.ActionReason)}
	if err := h.service.AdjustQuotaSize(ctx, actor.From(ctx), in.ID, change); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *UserHandler) adjustQuotaUsed(ctx context.Context, in *adminUserQuotaUsedInput) (*response.EmptyOutput, error) {
	change := admin.QuotaChange{Action: upload.QuotaAction(in.Body.Action), Amount: in.Body.Amount, Reason: deref(in.Body.ActionReason)}
	if err := h.service.AdjustQuotaUsed(ctx, actor.From(ctx), in.ID, change); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *UserHandler) resetQuotaUsed(ctx context.Context, in *adminUserPath) (*response.EmptyOutput, error) {
	if err := h.service.ResetQuotaUsed(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *UserHandler) setSponsor(ctx context.Context, in *adminUserSponsorInput) (*response.EmptyOutput, error) {
	if err := h.service.SetSponsorExpiry(ctx, in.ID, in.Body.SponsorExpiresAt); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
