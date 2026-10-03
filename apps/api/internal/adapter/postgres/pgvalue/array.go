package pgvalue

import (
	"database/sql/driver"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

type Strings []string

func (s Strings) Value() (driver.Value, error) {
	return encodeArray(len(s), func(i int) (string, bool) { return s[i], true }), nil
}

func (s *Strings) Scan(src any) error {
	elements, err := decodeArray(src)
	if err != nil {
		return err
	}
	if elements == nil {
		*s = nil
		return nil
	}
	out := make(Strings, 0, len(elements))
	for _, element := range elements {
		if element == nil {
			return errors.New("pgvalue: NULL element in text array")
		}
		out = append(out, *element)
	}
	*s = out
	return nil
}

type Ints []int

func (s Ints) Value() (driver.Value, error) {
	return encodeArray(len(s), func(i int) (string, bool) { return strconv.Itoa(s[i]), false }), nil
}

func (s *Ints) Scan(src any) error {
	elements, err := decodeArray(src)
	if err != nil {
		return err
	}
	if elements == nil {
		*s = nil
		return nil
	}
	out := make(Ints, 0, len(elements))
	for _, element := range elements {
		if element == nil {
			return errors.New("pgvalue: NULL element in integer array")
		}
		value, err := strconv.Atoi(*element)
		if err != nil {
			return fmt.Errorf("pgvalue: parse integer array element %q: %w", *element, err)
		}
		out = append(out, value)
	}
	*s = out
	return nil
}

func encodeArray(n int, element func(int) (string, bool)) string {
	var builder strings.Builder
	builder.WriteByte('{')
	for i := range n {
		if i > 0 {
			builder.WriteByte(',')
		}
		value, quote := element(i)
		if !quote {
			builder.WriteString(value)
			continue
		}
		builder.WriteByte('"')
		for _, r := range value {
			if r == '"' || r == '\\' {
				builder.WriteByte('\\')
			}
			builder.WriteRune(r)
		}
		builder.WriteByte('"')
	}
	builder.WriteByte('}')
	return builder.String()
}

func decodeArray(src any) ([]*string, error) {
	var raw string
	switch typed := src.(type) {
	case nil:
		return nil, nil
	case string:
		raw = typed
	case []byte:
		raw = string(typed)
	default:
		return nil, fmt.Errorf("pgvalue: cannot scan %T into array", src)
	}
	if strings.HasPrefix(raw, "[") {
		if eq := strings.Index(raw, "="); eq >= 0 {
			raw = raw[eq+1:]
		}
	}
	if len(raw) < 2 || raw[0] != '{' || raw[len(raw)-1] != '}' {
		return nil, fmt.Errorf("pgvalue: malformed array literal %q", raw)
	}
	body := raw[1 : len(raw)-1]
	elements := []*string{}
	if body == "" {
		return elements, nil
	}
	for i := 0; i <= len(body); {
		if i < len(body) && body[i] == '"' {
			var builder strings.Builder
			i++
			for i < len(body) && body[i] != '"' {
				if body[i] == '\\' && i+1 < len(body) {
					i++
				}
				builder.WriteByte(body[i])
				i++
			}
			if i >= len(body) {
				return nil, fmt.Errorf("pgvalue: unterminated quoted element in %q", raw)
			}
			i++
			value := builder.String()
			elements = append(elements, &value)
		} else {
			end := strings.IndexByte(body[i:], ',')
			if end < 0 {
				end = len(body) - i
			}
			token := body[i : i+end]
			if token == "" || strings.ContainsAny(token, "{}\"\\") {
				return nil, fmt.Errorf("pgvalue: malformed unquoted element %q in %q", token, raw)
			}
			if token == "NULL" {
				elements = append(elements, nil)
			} else {
				value := token
				elements = append(elements, &value)
			}
			i += end
		}
		if i < len(body) && body[i] != ',' {
			return nil, fmt.Errorf("pgvalue: unexpected character %q in %q", body[i], raw)
		}
		i++
	}
	return elements, nil
}
