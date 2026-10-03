package httpapi

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type CORS struct {
	Origins []string
	Methods []string
}

type ThrottleFactory func(policy string) func(huma.Context, func(huma.Context))

type Options struct {
	Title          string
	Version        string
	ExposeOpenAPI  bool
	Logger         *slog.Logger
	Catalog        *i18n.Catalog
	Builder        *response.Builder
	ClientResolver *clientinfo.Resolver
	Authenticator  middleware.Authenticator
	CORS           CORS
	QuietPaths     []string
	Global         []func(http.Handler) http.Handler
	Throttle       ThrottleFactory
}

type API struct {
	router   chi.Router
	huma     huma.API
	mapper   *errmap.Mapper
	writer   *errmap.Writer
	builder  *response.Builder
	throttle ThrottleFactory
}

func New(opts Options) *API {
	mapper := errmap.NewMapper(opts.Builder)
	mapper.Install()
	writer := errmap.NewWriter(opts.Logger)

	router := chi.NewRouter()
	router.Use(
		middleware.RequestContext(opts.ClientResolver),
		middleware.AccessLog(opts.Logger, opts.QuietPaths),
		middleware.Recover(mapper, writer, opts.Logger),
		cors(opts.CORS),
		middleware.Locale(opts.Catalog),
		middleware.Authenticate(opts.Authenticator),
	)
	for _, global := range opts.Global {
		router.Use(global)
	}
	notFound := func(w http.ResponseWriter, r *http.Request) {
		writer.Write(w, r, mapper.FromStatus(r.Context(), http.StatusNotFound, nil))
	}
	router.NotFound(notFound)
	router.MethodNotAllowed(notFound)

	config := huma.DefaultConfig(opts.Title, opts.Version)
	config.CreateHooks = nil
	config.DocsPath = ""
	config.SchemasPath = ""
	config.OpenAPIPath = ""
	if opts.ExposeOpenAPI {
		config.OpenAPIPath = "/openapi"
	}
	config.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		"accessToken":  {Type: "http", Scheme: "bearer", BearerFormat: "JWT"},
		"accessCookie": {Type: "apiKey", In: "cookie", Name: middleware.AccessTokenCookie},
	}

	return &API{
		router:   router,
		huma:     humachi.New(router, config),
		mapper:   mapper,
		writer:   writer,
		builder:  opts.Builder,
		throttle: opts.Throttle,
	}
}

func (a *API) Handler() http.Handler {
	return a.router
}

func (a *API) Router() chi.Router {
	return a.router
}

func (a *API) OpenAPI() *huma.OpenAPI {
	return a.huma.OpenAPI()
}

func (a *API) Mapper() *errmap.Mapper {
	return a.mapper
}

func (a *API) ErrorWriter() *errmap.Writer {
	return a.writer
}

func (a *API) Builder() *response.Builder {
	return a.builder
}

func (a *API) writeErr(ctx huma.Context, resp *errmap.ErrorResponse) {
	for key, values := range resp.GetHeaders() {
		for _, value := range values {
			ctx.AppendHeader(key, value)
		}
	}
	if err := huma.WriteErr(a.huma, ctx, resp.GetStatus(), resp.Message, resp); err != nil {
		return
	}
}

func cors(cfg CORS) func(http.Handler) http.Handler {
	allowAll := len(cfg.Origins) == 0
	allowed := map[string]bool{}
	for _, origin := range cfg.Origins {
		if origin == "*" {
			allowAll = true
		}
		allowed[origin] = true
	}
	methods := strings.Join(cfg.Methods, ",")
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				header := w.Header()
				header.Add("Vary", "Origin")
				switch {
				case allowAll:
					header.Set("Access-Control-Allow-Origin", "*")
				case allowed[origin]:
					header.Set("Access-Control-Allow-Origin", origin)
				}
				header.Set("Access-Control-Expose-Headers", "shionlib-auth-stale")
				if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
					header.Set("Access-Control-Allow-Methods", methods)
					header.Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
