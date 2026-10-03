package telemetry

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

const (
	instrumentationName = "github.com/Ringyuki/shionlib/apps/api"
	tracesPath          = "/v1/traces"
)

type Options struct {
	Endpoint    string
	IngestKey   string
	SampleRate  float64
	ServiceName string
	Version     string
	Environment string
	HTTPClient  *http.Client
}

type Telemetry struct {
	provider *sdktrace.TracerProvider
}

func Setup(ctx context.Context, opts Options) (*Telemetry, error) {
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	if opts.Endpoint == "" {
		return &Telemetry{}, nil
	}
	exporterOptions := []otlptracehttp.Option{
		otlptracehttp.WithEndpointURL(strings.TrimRight(opts.Endpoint, "/") + tracesPath),
	}
	if opts.IngestKey != "" {
		exporterOptions = append(exporterOptions, otlptracehttp.WithHeaders(map[string]string{"Authorization": "Bearer " + opts.IngestKey}))
	}
	if opts.HTTPClient != nil {
		exporterOptions = append(exporterOptions, otlptracehttp.WithHTTPClient(opts.HTTPClient))
	}
	exporter, err := otlptracehttp.New(ctx, exporterOptions...)
	if err != nil {
		return nil, fmt.Errorf("create trace exporter: %w", err)
	}
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(opts.SampleRate))),
		sdktrace.WithResource(resource.NewSchemaless(
			attribute.String("service.name", opts.ServiceName),
			attribute.String("service.version", opts.Version),
			attribute.String("deployment.environment", opts.Environment),
		)),
	)
	otel.SetTracerProvider(provider)
	return &Telemetry{provider: provider}, nil
}

func (t *Telemetry) Enabled() bool {
	return t != nil && t.provider != nil
}

func (t *Telemetry) Shutdown(ctx context.Context) error {
	if !t.Enabled() {
		return nil
	}
	return errors.Join(t.provider.ForceFlush(ctx), t.provider.Shutdown(ctx))
}

func Tracer() trace.Tracer {
	return otel.Tracer(instrumentationName)
}
