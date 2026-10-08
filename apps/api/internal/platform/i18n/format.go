package i18n

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	selectKind   = "select"
	absentOption = "none"
	otherOption  = "other"
)

func format(message string, args map[string]any) string {
	if !strings.Contains(message, "{") {
		return message
	}
	var out strings.Builder
	out.Grow(len(message))
	for {
		open := strings.IndexByte(message, '{')
		if open < 0 {
			out.WriteString(message)
			return out.String()
		}
		length := closing(message[open:])
		if length < 0 {
			out.WriteString(message)
			return out.String()
		}
		out.WriteString(message[:open])
		argument := message[open : open+length+1]
		out.WriteString(resolve(argument, args))
		message = message[open+length+1:]
	}
}

func closing(text string) int {
	depth := 0
	for i, r := range text {
		switch r {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}

func resolve(argument string, args map[string]any) string {
	inner := argument[1 : len(argument)-1]
	name, rest, composite := strings.Cut(inner, ",")
	name = strings.TrimSpace(name)
	value, present := args[name]
	if !composite {
		if !present {
			return argument
		}
		return stringify(value)
	}
	kind, body, _ := strings.Cut(rest, ",")
	if strings.TrimSpace(kind) != selectKind {
		return argument
	}
	options := selectOptions(body)
	chosen, ok := options[optionFor(value, present)]
	if !ok {
		chosen = options[otherOption]
	}
	return format(chosen, args)
}

func selectOptions(body string) map[string]string {
	options := map[string]string{}
	for {
		open := strings.IndexByte(body, '{')
		if open < 0 {
			return options
		}
		length := closing(body[open:])
		if length < 0 {
			return options
		}
		options[strings.TrimSpace(body[:open])] = body[open+1 : open+length]
		body = body[open+length+1:]
	}
}

func optionFor(value any, present bool) string {
	if !present || absent(value) {
		return absentOption
	}
	return stringify(value)
}

func absent(value any) bool {
	switch typed := value.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(typed) == ""
	case bool:
		return !typed
	case int:
		return typed == 0
	case int64:
		return typed == 0
	case float64:
		return typed == 0
	case []string:
		return len(typed) == 0
	case []any:
		return len(typed) == 0
	default:
		return false
	}
}

func stringify(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case []string:
		return strings.Join(typed, ", ")
	case []any:
		parts := make([]string, len(typed))
		for i, part := range typed {
			parts[i] = stringify(part)
		}
		return strings.Join(parts, ", ")
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case fmt.Stringer:
		return typed.String()
	default:
		return fmt.Sprint(typed)
	}
}
