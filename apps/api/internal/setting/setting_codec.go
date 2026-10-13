package setting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"time"
	"unicode/utf8"
)

func encode(value any) json.RawMessage {
	raw, err := json.Marshal(value)
	if err != nil {
		panic(fmt.Sprintf("setting: encode %v: %v", value, err))
	}
	return raw
}

func seconds(value time.Duration) int64 {
	return int64(value / time.Second)
}

func decode(raw json.RawMessage, target any) error {
	if trimmed := bytes.TrimSpace(raw); len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return errMalformed
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if decoder.More() {
		return errMalformed
	}
	return nil
}

func decodeNumber(raw json.RawMessage) (json.Number, bool) {
	var value any
	if decode(raw, &value) != nil {
		return "", false
	}
	number, ok := value.(json.Number)
	return number, ok
}

func invalid(message string) error {
	return ErrInvalidValue.WithField("value", message)
}

func parseWhole(raw json.RawMessage, low, high int64) (int64, error) {
	number, ok := decodeNumber(raw)
	if !ok {
		return 0, invalid("must be a whole number")
	}
	value, err := strconv.ParseInt(number.String(), 10, 64)
	if err != nil {
		return 0, invalid("must be a whole number")
	}
	if value < low || value > high {
		return 0, invalid(fmt.Sprintf("must be between %d and %d", low, high))
	}
	return value, nil
}

func parseFloat(raw json.RawMessage, low, high float64) (float64, error) {
	number, ok := decodeNumber(raw)
	if !ok {
		return 0, invalid("must be a number")
	}
	value, err := number.Float64()
	if err != nil {
		return 0, invalid("must be a number")
	}
	if value < low || value > high {
		return 0, invalid(fmt.Sprintf("must be between %g and %g", low, high))
	}
	return value, nil
}

func parseFlag(raw json.RawMessage) (any, error) {
	var value bool
	if decode(raw, &value) != nil {
		return false, invalid("must be true or false")
	}
	return value, nil
}

func parseText(raw json.RawMessage, maxLength int) (string, error) {
	var value string
	if decode(raw, &value) != nil {
		return "", invalid("must be a string")
	}
	if utf8.RuneCountInString(value) > maxLength {
		return "", invalid(fmt.Sprintf("must be at most %d characters", maxLength))
	}
	return value, nil
}
