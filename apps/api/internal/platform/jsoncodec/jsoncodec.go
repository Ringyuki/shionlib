package jsoncodec

import (
	"encoding/json"
	"encoding/json/jsontext"
	jsonv2 "encoding/json/v2"
	"io"
	"time"
)

const TimeLayout = "2006-01-02T15:04:05.000Z"

var options = jsonv2.JoinOptions(
	json.DefaultOptionsV1(),
	jsontext.EscapeForHTML(false),
	jsonv2.WithMarshalers(jsonv2.MarshalToFunc(func(enc *jsontext.Encoder, t time.Time) error {
		return enc.WriteToken(jsontext.String(t.UTC().Format(TimeLayout)))
	})),
)

func Marshal(v any) ([]byte, error) {
	return jsonv2.Marshal(v, options)
}

func Encode(w io.Writer, v any) error {
	if err := jsonv2.MarshalWrite(w, v, options); err != nil {
		return err
	}
	_, err := io.WriteString(w, "\n")
	return err
}
