package httpapi_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/netip"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type shelfOwnerDTO struct {
	Name string `json:"name"`
}

type shelfBookDTO struct {
	Title  string         `json:"title"`
	Lender *shelfOwnerDTO `json:"lender"`
}

type shelfDTO struct {
	Owner    shelfOwnerDTO  `json:"owner"`
	Keeper   *shelfOwnerDTO `json:"keeper" doc:"Who looks after the shelf"`
	Guest    *shelfOwnerDTO `json:"guest,omitempty"`
	Books    []shelfBookDTO `json:"books"`
	Emptied  *time.Time     `json:"emptied"`
	Nickname *string        `json:"nickname"`
}

func TestObjectsThatMayBeNullSayItInTheContract(t *testing.T) {
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	builder := response.NewBuilder(catalog, time.Now)
	api := httpapi.New(httpapi.Options{
		Title:          "test",
		Version:        "test",
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Catalog:        catalog,
		Builder:        builder,
		ClientResolver: clientinfo.NewResolver([]netip.Prefix{netip.MustParsePrefix("127.0.0.0/8")}),
		Authenticator:  fakeAuthenticator{},
	})
	httpapi.Register(api, httpapi.Route{ID: "shelf.get", Method: http.MethodGet, Path: "/shelf"},
		func(ctx context.Context, _ *struct{}) (*response.Output[shelfDTO], error) {
			return response.OK(ctx, builder, shelfDTO{}), nil
		})
	schemas := api.OpenAPI().Components.Schemas.Map()
	shelf := schemas["ShelfDTO"]
	if shelf == nil {
		t.Fatalf("shelf schema missing: %v", len(schemas))
	}
	keeper := shelf.Properties["keeper"]
	if keeper == nil || len(keeper.OneOf) != 2 || keeper.OneOf[0].Ref != "#/components/schemas/ShelfOwnerDTO" || keeper.OneOf[1].Type != "null" || keeper.Description != "Who looks after the shelf" {
		t.Fatalf("a pointer to an object is that object or null, and keeps its description: %+v", shelf.Properties["keeper"])
	}
	if shelf.Properties["owner"].Ref == "" {
		t.Fatalf("an object that is always there stays a plain reference: %+v", shelf.Properties["owner"])
	}
	if shelf.Properties["guest"].Ref == "" {
		t.Fatalf("an omitted field is optional, not null: %+v", shelf.Properties["guest"])
	}
	book := schemas["ShelfBookDTO"]
	if book == nil || len(book.Properties["lender"].OneOf) != 2 {
		t.Fatalf("objects inside lists are marked as well: %+v", book)
	}
	if len(shelf.Properties["emptied"].OneOf) != 0 || len(shelf.Properties["nickname"].OneOf) != 0 {
		t.Fatalf("times and scalars keep their own nullable form: %+v %+v", shelf.Properties["emptied"], shelf.Properties["nickname"])
	}
}
