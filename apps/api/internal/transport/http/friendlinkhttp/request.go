package friendlinkhttp

import (
	"encoding/json"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
)

type friendLinkPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type createFriendLinkInput struct {
	Body struct {
		Name        string  `json:"name" minLength:"1" maxLength:"50"`
		URL         string  `json:"url" minLength:"1" maxLength:"500" pattern:"^https?://" patternDescription:"an http or https address"`
		Logo        *string `json:"logo,omitempty" maxLength:"500" doc:"A key in the image bucket, or an address of an image elsewhere"`
		Description string  `json:"description,omitempty" maxLength:"200"`
		Visible     *bool   `json:"visible,omitempty" doc:"Whether the link is shown on the site; true when left out"`
	}
}

func (in *createFriendLinkInput) link() friendlink.NewLink {
	body := in.Body
	return friendlink.NewLink{Name: body.Name, URL: body.URL, Logo: body.Logo, Description: body.Description, Visible: body.Visible == nil || *body.Visible}
}

type updateFriendLinkInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Name        *string           `json:"name,omitempty" minLength:"1" maxLength:"50"`
		URL         *string           `json:"url,omitempty" minLength:"1" maxLength:"500" pattern:"^https?://" patternDescription:"an http or https address"`
		Logo        nullableLogoInput `json:"logo,omitempty" doc:"null removes the logo"`
		Description *string           `json:"description,omitempty" maxLength:"200"`
		Visible     *bool             `json:"visible,omitempty"`
	}
}

func (in *updateFriendLinkInput) changes() friendlink.Changes {
	body := in.Body
	return friendlink.Changes{Name: body.Name, URL: body.URL, Logo: patch.Clearable[string](body.Logo), Description: body.Description, Visible: body.Visible}
}

type reorderFriendLinksInput struct {
	Body struct {
		IDs []int `json:"ids" maxItems:"1000" doc:"Every friend link, in the order they are shown"`
	}
}

type nullableLogoInput struct {
	Set   bool
	Value *string
}

func (f *nullableLogoInput) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (nullableLogoInput) Schema(huma.Registry) *huma.Schema {
	maxLength := friendlink.MaxLogoLength
	return &huma.Schema{Type: huma.TypeString, Nullable: true, MaxLength: &maxLength}
}
