package httpapi

import (
	"context"
	"net/http"
	"reflect"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
)

type Access int

const (
	AccessOptional Access = iota
	AccessUser
	AccessAdmin
	AccessSuperAdmin
)

type Route struct {
	ID           string
	Method       string
	Path         string
	Summary      string
	Tags         []string
	Access       Access
	Status       int
	Throttle     string
	MaxBodyBytes int64
	Hidden       bool
}

const throttleMetadataKey = "throttle"

func Register[I, O any](api *API, route Route, handler func(context.Context, *I) (*O, error)) {
	checkPathParams(route.Path, reflect.TypeFor[I]())
	status := route.Status
	if status == 0 {
		status = http.StatusOK
		if route.Method == http.MethodPost {
			status = http.StatusCreated
		}
	}
	operation := huma.Operation{
		OperationID:   route.ID,
		Method:        route.Method,
		Path:          route.Path,
		Summary:       route.Summary,
		Tags:          route.Tags,
		DefaultStatus: status,
		MaxBodyBytes:  route.MaxBodyBytes,
		Hidden:        route.Hidden,
		Metadata:      map[string]any{},
	}
	if route.Access != AccessOptional {
		operation.Security = []map[string][]string{{"accessToken": {}}, {"accessCookie": {}}}
		operation.Middlewares = append(operation.Middlewares, api.requireAccess(route.Access))
	}
	throttle := route.Throttle
	if throttle == "" {
		throttle = DefaultThrottle
	}
	operation.Metadata[throttleMetadataKey] = throttle
	if api.throttling != nil {
		operation.Middlewares = append(huma.Middlewares{api.throttleMiddleware(throttle, route.Method, route.Path)}, operation.Middlewares...)
	}
	huma.Register(api.huma, operation, handler)
}

func (a *API) requireAccess(access Access) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		requestCtx := ctx.Context()
		if err := middleware.RequireAuthenticated(requestCtx); err != nil {
			a.writeErr(ctx, a.mapper.FromError(requestCtx, err))
			return
		}
		who := actor.From(requestCtx)
		if !allowed(who, access) {
			a.writeErr(ctx, a.mapper.FromStatus(requestCtx, http.StatusForbidden, nil))
			return
		}
		next(ctx)
	}
}

func allowed(who actor.Actor, access Access) bool {
	switch access {
	case AccessUser:
		return who.Authenticated()
	case AccessAdmin:
		return who.AtLeast(actor.RoleAdmin)
	case AccessSuperAdmin:
		return who.Authenticated() && who.Role == actor.RoleSuperAdmin
	default:
		return true
	}
}
