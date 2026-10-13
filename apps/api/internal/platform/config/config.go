package config

import (
	"time"
)

type Config struct {
	App        App
	HTTP       HTTP
	Log        Log
	Telemetry  Telemetry
	Database   Database
	Redis      Redis
	Token      Token
	WebAuthn   WebAuthn
	OIDC       OIDC
	Email      Email
	Storage    Storage
	Upload     Upload
	FileScan   FileScan
	Download   Download
	Catalog    Catalog
	Cloudflare Cloudflare
	Cap        Cap
	Bangumi    Bangumi
	AI         AI
	NextMoe    NextMoe
	PotatoVN   PotatoVN
	Tasks      Tasks
}

type App struct {
	Name            string        `env:"APP_NAME" envDefault:"shionlib-api"`
	Environment     string        `env:"APP_ENV" envDefault:"production"`
	Version         string        `env:"APP_VERSION" envDefault:"dev"`
	SiteURL         string        `env:"SITE_URL" envDefault:"https://shionlib.com"`
	DefaultLocale   string        `env:"DEFAULT_LOCALE" envDefault:"zh"`
	ShutdownTimeout time.Duration `env:"SHUTDOWN_TIMEOUT" envDefault:"30s"`
}

type HTTP struct {
	Port              int           `env:"PORT" envDefault:"5000"`
	TrustedProxies    []string      `env:"TRUSTED_PROXIES" envDefault:"127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::1/128,fc00::/7"`
	CORSOrigins       []string      `env:"CORS_ORIGIN" envDefault:"*"`
	CORSMethods       []string      `env:"CORS_METHODS" envDefault:"GET,POST,PUT,DELETE,OPTIONS,PATCH"`
	ExposeOpenAPI     bool          `env:"HTTP_EXPOSE_OPENAPI" envDefault:"false"`
	ReadHeaderTimeout time.Duration `env:"HTTP_READ_HEADER_TIMEOUT" envDefault:"10s"`
	ReadTimeout       time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"10m"`
	WriteTimeout      time.Duration `env:"HTTP_WRITE_TIMEOUT" envDefault:"10m"`
	IdleTimeout       time.Duration `env:"HTTP_IDLE_TIMEOUT" envDefault:"120s"`
}

type Telemetry struct {
	Endpoint   string  `env:"OTEL_EXPORTER_OTLP_ENDPOINT"`
	Headers    string  `env:"OTEL_EXPORTER_OTLP_HEADERS"`
	SampleRate float64 `env:"OTEL_TRACES_SAMPLER_ARG" envDefault:"1"`
}

type Log struct {
	Level  string `env:"LOG_LEVEL" envDefault:"info"`
	Format string `env:"LOG_FORMAT" envDefault:"json"`
}

type Database struct {
	URL                    string        `env:"DATABASE_URL"`
	MaxConns               int           `env:"DATABASE_MAX_CONNS" envDefault:"20"`
	MinConns               int           `env:"DATABASE_MIN_CONNS" envDefault:"2"`
	ConnMaxLifetime        time.Duration `env:"DATABASE_CONN_MAX_LIFETIME" envDefault:"30m"`
	ConnMaxIdleTime        time.Duration `env:"DATABASE_CONN_MAX_IDLE_TIME" envDefault:"5m"`
	StatementTimeout       time.Duration `env:"DATABASE_STATEMENT_TIMEOUT" envDefault:"30s"`
	BackupEnabled          bool          `env:"ENABLE_BACKUP" envDefault:"false"`
	BackupRetentionDaily   int           `env:"DATABASE_BACKUP_RETENTION_DAILY" envDefault:"7"`
	BackupRetentionWeekly  int           `env:"DATABASE_BACKUP_RETENTION_WEEKLY" envDefault:"4"`
	BackupPgDumpBinaryPath string        `env:"DATABASE_BACKUP_PG_DUMP_PATH" envDefault:"pg_dump"`
}

type Redis struct {
	Host      string        `env:"REDIS_HOST" envDefault:"localhost"`
	Port      int           `env:"REDIS_PORT" envDefault:"6379"`
	Password  string        `env:"REDIS_PASSWORD"`
	DB        int           `env:"REDIS_DB" envDefault:"0"`
	KeyPrefix string        `env:"REDIS_KEY_PREFIX" envDefault:"shionlib"`
	Timeout   time.Duration `env:"REDIS_TIMEOUT" envDefault:"3s"`
}

type Token struct {
	Secret                  string        `env:"TOKEN_SECRET"`
	ExpiresIn               time.Duration `env:"TOKEN_EXPIRES_IN" envDefault:"1h"`
	RefreshShortWindow      time.Duration `env:"REFRESH_TOKEN_SHORT_WINDOW" envDefault:"168h"`
	RefreshLongWindow       time.Duration `env:"REFRESH_TOKEN_LONG_WINDOW" envDefault:"720h"`
	RefreshPepper           string        `env:"REFRESH_TOKEN_PEPPER"`
	RefreshRotationGrace    time.Duration `env:"REFRESH_TOKEN_ROTATION_GRACE" envDefault:"100s"`
	RefreshAlgorithmVersion string        `env:"REFRESH_TOKEN_ALGORITHM_VERSION" envDefault:"slrt1"`
	CookieSecure            bool          `env:"AUTH_COOKIE_SECURE" envDefault:"true"`
}

type WebAuthn struct {
	RPID         string        `env:"WEBAUTHN_RP_ID" envDefault:"shionlib.com"`
	RPName       string        `env:"WEBAUTHN_RP_NAME" envDefault:"Shionlib"`
	Origins      []string      `env:"WEBAUTHN_ORIGINS" envDefault:"https://shionlib.com"`
	Timeout      time.Duration `env:"WEBAUTHN_TIMEOUT" envDefault:"60s"`
	ChallengeTTL time.Duration `env:"WEBAUTHN_CHALLENGE_TTL" envDefault:"5m"`
}

type OIDC struct {
	Issuer         string   `env:"OIDC_ISSUER" envDefault:"https://id.hikarinagi.org/oidc"`
	ClientID       string   `env:"OIDC_CLIENT_ID" envDefault:"shionlib"`
	ClientSecret   string   `env:"OIDC_CLIENT_SECRET"`
	AllowedOrigins []string `env:"OIDC_ALLOWED_ORIGINS" envDefault:"https://shionlib.com"`
	Scopes         []string `env:"OIDC_SCOPES" envSeparator:" " envDefault:"openid profile email"`
}

type Email struct {
	Provider      string `env:"EMAIL_PROVIDER" envDefault:"elastic"`
	APIKey        string `env:"EMAIL_PROVIDER_API_KEY"`
	Endpoint      string `env:"EMAIL_PROVIDER_ENDPOINT"`
	SenderAddress string `env:"EMAIL_SENDER_ADDRESS"`
	SenderName    string `env:"EMAIL_SENDER_NAME" envDefault:"Shionlib"`
}

type Bucket struct {
	Bucket          string `env:"BUCKET"`
	Region          string `env:"REGION" envDefault:"auto"`
	Endpoint        string `env:"ENDPOINT"`
	AccessKeyID     string `env:"ACCESS_KEY_ID"`
	SecretAccessKey string `env:"SECRET_ACCESS_KEY"`
	ForcePathStyle  bool   `env:"FORCE_PATH_STYLE" envDefault:"false"`
}

type Storage struct {
	Image              Bucket `envPrefix:"S3_IMAGE_"`
	Game               Bucket `envPrefix:"S3_FILE_"`
	Backup             Bucket `envPrefix:"S3_BACKUP_"`
	ImageBaseURL       string `env:"IMAGE_BASE_URL" envDefault:"https://t.shionlib.com"`
	B2ApplicationKeyID string `env:"B2_APPLICATION_KEY_ID"`
	B2ApplicationKey   string `env:"B2_APPLICATION_KEY"`
}

type Upload struct {
	RootDir        string `env:"FILE_UPLOAD_ROOT_DIR" envDefault:"/var/lib/shionlib/upload"`
	TempFileSuffix string `env:"FILE_UPLOAD_TEMP_FILE_SUFFIX" envDefault:".sltf"`
}

type FileScan struct {
	Enabled         bool          `env:"FILE_SCAN_ENABLED" envDefault:"true"`
	ClamdHost       string        `env:"CLAMDSCAN_HOST" envDefault:"clamav"`
	ClamdPort       int           `env:"CLAMDSCAN_PORT" envDefault:"3310"`
	ClamdTimeout    time.Duration `env:"CLAMDSCAN_TIMEOUT" envDefault:"2m"`
	ArchiveToolPath string        `env:"ARCHIVE_TOOL_PATH" envDefault:"7zz"`
	ScanLogDir      string        `env:"FILE_SCAN_LOG_DIR" envDefault:"/var/lib/shionlib/scan-logs"`
}

type Download struct {
	Mode         string `env:"FILE_DOWNLOAD_MODE" envDefault:"direct"`
	CDNHost      string `env:"FILE_DOWNLOAD_CDN_HOST" envDefault:"https://ft.hikarifallback.uk/"`
	WorkerHost   string `env:"FILE_DOWNLOAD_PROXY_WORKER_HOST" envDefault:"https://dl.hikarifallback.uk/"`
	TicketSecret string `env:"FILE_DOWNLOAD_TICKET_SECRET"`
}

type Catalog struct {
	Source        string `env:"CATALOG_SOURCE" envDefault:"hikarinagi"`
	CreatorID     int    `env:"CATALOG_IMPORT_CREATOR_ID" envDefault:"1"`
	ImportWorkers int    `env:"CATALOG_IMPORT_WORKERS" envDefault:"2"`
	Hikarinagi    Hikarinagi
}

type Hikarinagi struct {
	APIBaseURL     string        `env:"HIKARINAGI_API_BASE_URL" envDefault:"https://api.hikarinagi.org/api/v3"`
	TokenURL       string        `env:"HIKARINAGI_TOKEN_URL" envDefault:"https://id.hikarinagi.org/oidc/token"`
	ClientID       string        `env:"HIKARINAGI_CLIENT_ID"`
	ClientSecret   string        `env:"HIKARINAGI_CLIENT_SECRET"`
	Resource       string        `env:"HIKARINAGI_OPEN_RESOURCE" envDefault:"https://api.hikarinagi.org/open"`
	Scopes         []string      `env:"HIKARINAGI_SCOPES" envSeparator:" " envDefault:"catalog:full catalog:sync"`
	Timeout        time.Duration `env:"HIKARINAGI_TIMEOUT" envDefault:"15s"`
	RequestsPerMin int           `env:"HIKARINAGI_REQUESTS_PER_MINUTE" envDefault:"55"`
}

type Cloudflare struct {
	AccountID       string `env:"CLOUDFLARE_ACCOUNT_ID"`
	AnalyticsSecret string `env:"CLOUDFLARE_ANALYTICS_SECRET"`
	AnalyticsZoneID string `env:"CLOUDFLARE_ANALYTICS_ZONE_ID"`
}

type Cap struct {
	URL     string `env:"CAP_URL"`
	SiteKey string `env:"CAP_SITE_KEY"`
	Secret  string `env:"CAP_SECRET"`
}

type Bangumi struct {
	ClientID     string `env:"BANGUMI_CLIENT_ID"`
	ClientSecret string `env:"BANGUMI_CLIENT_SECRET"`
}

type AI struct {
	CatalogURL      string        `env:"AI_CATALOG_URL" envDefault:"https://models.dev/api.json"`
	IdleTimeout     time.Duration `env:"AI_IDLE_TIMEOUT" envDefault:"120s"`
	MaxCallDuration time.Duration `env:"AI_MAX_CALL_DURATION" envDefault:"10m"`
}

type NextMoe struct {
	BaseURL string `env:"NEXTMOE_API_BASE_URL" envDefault:"https://api.nextmoe.dev"`
	APIKey  string `env:"NEXTMOE_API_KEY"`
}

type PotatoVN struct {
	BaseURL string `env:"POTATOVN_BASE_URL" envDefault:"https://api.potatovn.net"`
}

type Tasks struct {
	WorkersEnabled     bool   `env:"WORKERS_ENABLED" envDefault:"true"`
	ScheduleTimezone   string `env:"SCHEDULE_TIMEZONE" envDefault:"Asia/Shanghai"`
	ImageUploadEnabled bool   `env:"TASKS_IMAGE_UPLOAD_ENABLED" envDefault:"true"`
}
