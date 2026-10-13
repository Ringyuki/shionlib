package idatariver

import (
	"bytes"
	"encoding/json"
	"mime"
	"net/url"

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

func (c *Client) CallbackOrderID(callback sponsor.Callback) string {
	mediaType, _, _ := mime.ParseMediaType(callback.ContentType)
	if mediaType == "application/x-www-form-urlencoded" {
		values, err := url.ParseQuery(string(callback.Body))
		if err != nil {
			return ""
		}
		return values.Get("orderId")
	}
	var body struct {
		OrderID json.RawMessage `json:"orderId"`
	}
	if err := json.Unmarshal(callback.Body, &body); err != nil {
		return ""
	}
	var text string
	if err := json.Unmarshal(body.OrderID, &text); err == nil {
		return text
	}
	var number json.Number
	decoder := json.NewDecoder(bytes.NewReader(body.OrderID))
	decoder.UseNumber()
	if err := decoder.Decode(&number); err == nil {
		return number.String()
	}
	return ""
}
