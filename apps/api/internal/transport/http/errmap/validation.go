package errmap

import (
	"context"
	"fmt"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

type translateFunc func(ctx context.Context, key string, args map[string]any) string

type validationRule struct {
	prefix string
	key    string
	arg    string
}

var validationRules = []validationRule{
	{prefix: "expected array length >= ", key: "validation.common.ARRAY_MIN_SIZE", arg: "min"},
	{prefix: "expected array length <= ", key: "validation.common.ARRAY_MAX_SIZE", arg: "max"},
	{prefix: "expected number >= ", key: "validation.common.MIN", arg: "min"},
	{prefix: "expected number > ", key: "validation.common.MIN", arg: "min"},
	{prefix: "expected number <= ", key: "validation.common.MAX", arg: "max"},
	{prefix: "expected number < ", key: "validation.common.MAX", arg: "max"},
	{prefix: "expected length >= ", key: "validation.common.MIN_LENGTH", arg: "min"},
	{prefix: "expected length <= ", key: "validation.common.MAX_LENGTH", arg: "max"},
	{prefix: "expected value to be one of ", key: "validation.common.IS_ENUM", arg: "allowed"},
	{prefix: "expected string to be RFC 5322 email", key: "validation.common.IS_EMAIL"},
	{prefix: "expected string to be RFC 3986", key: "validation.common.IS_URL"},
	{prefix: "expected string to be RFC 4122 uuid", key: "validation.common.IS_UUID"},
	{prefix: "expected string to be RFC 3339", key: "validation.common.IS_DATE"},
	{prefix: "expected string to be RFC 1123", key: "validation.common.IS_DATE"},
	{prefix: "expected string", key: "validation.common.IS_STRING"},
	{prefix: "expected integer", key: "validation.common.IS_INT"},
	{prefix: "expected number", key: "validation.common.IS_NUMBER"},
	{prefix: "expected boolean", key: "validation.common.IS_BOOLEAN"},
	{prefix: "expected array", key: "validation.common.IS_ARRAY"},
	{prefix: "expected object", key: "validation.common.IS_OBJECT"},
	{prefix: "unexpected property", key: "validation.common.PROPERTY_SHOULD_NOT_EXIST"},
}

const requiredPrefix = "expected required property "

func fieldErrors(ctx context.Context, translate translateFunc, errs []error) []apperror.FieldError {
	order := make([]string, 0, len(errs))
	byField := map[string][]string{}
	for _, err := range errs {
		if err == nil {
			continue
		}
		field, message := describe(ctx, translate, err)
		if _, seen := byField[field]; !seen {
			order = append(order, field)
		}
		byField[field] = append(byField[field], message)
	}
	result := make([]apperror.FieldError, 0, len(order))
	for _, field := range order {
		result = append(result, apperror.FieldError{Field: field, Messages: byField[field]})
	}
	return result
}

func describe(ctx context.Context, translate translateFunc, err error) (string, string) {
	detailer, ok := err.(huma.ErrorDetailer)
	if !ok {
		return "", err.Error()
	}
	detail := detailer.ErrorDetail()
	field := fieldName(detail.Location)
	if property, found := strings.CutPrefix(detail.Message, requiredPrefix); found {
		property = strings.TrimSuffix(property, " to be present")
		if field == "" {
			field = property
		} else {
			field = field + "." + property
		}
		return field, translate(ctx, "validation.common.IS_NOT_EMPTY", map[string]any{"property": property})
	}
	property := lastSegment(field)
	for _, rule := range validationRules {
		rest, matched := strings.CutPrefix(detail.Message, rule.prefix)
		if !matched {
			continue
		}
		args := map[string]any{"property": property}
		if rule.arg != "" {
			args[rule.arg] = strings.Trim(strings.TrimSpace(rest), `"`)
		}
		return field, translate(ctx, rule.key, args)
	}
	return field, detail.Message
}

func fieldName(location string) string {
	for _, prefix := range []string{"body.", "query.", "path.", "header.", "cookie."} {
		if rest, ok := strings.CutPrefix(location, prefix); ok {
			return rest
		}
	}
	switch location {
	case "body", "query", "path", "header", "cookie":
		return ""
	}
	return location
}

func lastSegment(field string) string {
	if field == "" {
		return field
	}
	index := strings.LastIndexByte(field, '.')
	segment := field[index+1:]
	if bracket := strings.IndexByte(segment, '['); bracket > 0 {
		return segment[:bracket]
	}
	return segment
}

func formatStatusMessage(status int) string {
	return fmt.Sprintf("http.%d", status)
}
