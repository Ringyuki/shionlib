package sponsorhttp

import "testing"

func TestCallbackOrderIDAcceptsEveryProviderEncoding(t *testing.T) {
	cases := []struct {
		contentType string
		body        string
		want        string
	}{
		{"application/json", `{"orderId":"idr-1"}`, "idr-1"},
		{"application/json", `{"orderId":123456789012345678}`, "123456789012345678"},
		{"application/x-www-form-urlencoded; charset=utf-8", "orderId=idr-2&status=DONE", "idr-2"},
		{"application/json", `{"orderId":true}`, ""},
		{"application/json", `not json`, ""},
		{"application/json", `{}`, ""},
	}
	for _, tc := range cases {
		if got := callbackOrderID(tc.contentType, []byte(tc.body)); got != tc.want {
			t.Fatalf("%s %s: got %q want %q", tc.contentType, tc.body, got, tc.want)
		}
	}
}
