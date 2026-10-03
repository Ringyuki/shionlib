package sponsorhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type sponsorOrderPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type createSponsorOrderInput struct {
	Body struct {
		Amount    float64 `json:"amount" minimum:"1" maximum:"10000" doc:"Amount in USD"`
		IsPrivate *bool   `json:"isPrivate,omitempty"`
		Name      *string `json:"name,omitempty" maxLength:"100"`
		Message   *string `json:"message,omitempty" maxLength:"500"`
	}
}

type paySponsorOrderInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Method      string  `json:"method" minLength:"1" maxLength:"50"`
		RedirectURL *string `json:"redirectUrl,omitempty"`
	}
}

type getSponsorOrderInput struct {
	ID    int    `path:"id" minimum:"1"`
	Token string `query:"token" maxLength:"128" doc:"accessToken returned when the order was created; lets anonymous sponsors refresh the order"`
}

type sponsorWallInput struct {
	httpapi.PageQuery
}

type listSponsorOrdersInput struct {
	httpapi.PageQuery
	Status string `query:"status" enum:"NEW,DONE,EXPIRED,REFUND"`
}

type updateSponsorOrderStatusInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Status string `json:"status" enum:"NEW,DONE,EXPIRED,REFUND"`
	}
}

type sponsorWebhookInput struct {
	ContentType string `header:"Content-Type"`
	RawBody     []byte
}
