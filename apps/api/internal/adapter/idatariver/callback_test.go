package idatariver_test

import (
	"net/http"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/idatariver"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

func TestCallbackOrderIDAcceptsEveryEncodingTheProviderSends(t *testing.T) {
	client := idatariver.NewClient(&http.Client{}, settingtest.Source{})
	cases := []struct {
		contentType string
		body        string
		want        string
	}{
		{"application/json", `{"orderId":"idr-1"}`, "idr-1"},
		{"application/json", `{"orderId":123456789012345678}`, "123456789012345678"},
		{"application/x-www-form-urlencoded; charset=utf-8", "orderId=idr-2&status=DONE", "idr-2"},
		{"application/x-www-form-urlencoded", "orderId=%zz", ""},
		{"application/json", `{"orderId":true}`, ""},
		{"application/json", `not json`, ""},
		{"application/json", `{}`, ""},
		{"", ``, ""},
	}
	for _, tc := range cases {
		got := client.CallbackOrderID(sponsor.Callback{ContentType: tc.contentType, Body: []byte(tc.body)})
		if got != tc.want {
			t.Fatalf("%s %s: got %q want %q", tc.contentType, tc.body, got, tc.want)
		}
	}
}
