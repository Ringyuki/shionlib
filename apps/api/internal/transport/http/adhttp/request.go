package adhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type pathInput struct {
	ID int `path:"id" minimum:"1"`
}

type slotsInput struct {
	Slots  []string `query:"slot,explode" required:"true" minItems:"1" maxItems:"5" enum:"home,game,resource,download,sidebar" doc:"The slots on the page, one parameter per slot"`
	Locale string   `query:"locale" enum:"zh,en,ja" default:"zh" doc:"Language of the page"`
}

func (in *slotsInput) slots() []ad.Slot {
	return toSlots(in.Slots)
}

type adViewInput struct {
	AdID int    `json:"ad_id" minimum:"1"`
	Slot string `json:"slot" enum:"home,game,resource,download,sidebar"`
}

type adViewsInput struct {
	Body struct {
		Views []adViewInput `json:"views" maxItems:"50" doc:"Each ad seen, once per page view"`
	}
}

func (in *adViewsInput) views() []ad.View {
	views := make([]ad.View, len(in.Body.Views))
	for i, view := range in.Body.Views {
		views[i] = ad.View{AdID: view.AdID, Slot: ad.Slot(view.Slot)}
	}
	return views
}

type adClickInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Slot string `json:"slot" enum:"home,game,resource,download,sidebar" doc:"The slot the ad was clicked in"`
	}
}

type listInput struct {
	httpapi.PageQuery
	Status string `query:"status" enum:"running,scheduled,ended,disabled"`
	Slot   string `query:"slot" enum:"home,game,resource,download,sidebar"`
}

func (in *listInput) filter() ad.ListFilter {
	filter := ad.ListFilter{}
	if in.Status != "" {
		status := ad.Status(in.Status)
		filter.Status = &status
	}
	if in.Slot != "" {
		slot := ad.Slot(in.Slot)
		filter.Slot = &slot
	}
	return filter
}

type reportInput struct {
	ID   int `path:"id" minimum:"1"`
	Days int `query:"days" enum:"7,30" default:"30"`
}

type adDraftInput struct {
	Name        string     `json:"name" minLength:"1" maxLength:"100"`
	Link        string     `json:"link" minLength:"1" maxLength:"500" pattern:"^https?://" patternDescription:"an http or https address"`
	Banner      *string    `json:"banner,omitempty" nullable:"true" minLength:"1" maxLength:"500" doc:"Key of the 6:1 banner in the image bucket"`
	BannerAdult bool       `json:"banner_adult" doc:"The banner is shown only to viewers who see adult content"`
	SideImage   *string    `json:"side_image,omitempty" nullable:"true" minLength:"1" maxLength:"500" doc:"Key of the sidebar image; set together with side_icon"`
	SideIcon    *string    `json:"side_icon,omitempty" nullable:"true" minLength:"1" maxLength:"500" doc:"Key of the square icon the collapsed sidebar shows"`
	SideAdult   bool       `json:"side_adult" doc:"The sidebar image is shown only to viewers who see adult content"`
	Slots       []string   `json:"slots" maxItems:"5" enum:"home,game,resource,download,sidebar"`
	Languages   []string   `json:"languages" minItems:"1" maxItems:"3" enum:"zh,en,ja"`
	Weight      int        `json:"weight" minimum:"1" maximum:"10"`
	Enabled     bool       `json:"enabled"`
	StartAt     *time.Time `json:"start_at,omitempty" nullable:"true" doc:"Omitted or null starts at once"`
	EndAt       *time.Time `json:"end_at,omitempty" nullable:"true" doc:"Omitted or null runs without end"`
}

func (in adDraftInput) draft() ad.Draft {
	return ad.Draft{
		Name:        in.Name,
		Link:        in.Link,
		Banner:      in.Banner,
		BannerAdult: in.BannerAdult,
		SideImage:   in.SideImage,
		SideIcon:    in.SideIcon,
		SideAdult:   in.SideAdult,
		Slots:       toSlots(in.Slots),
		Languages:   in.Languages,
		Weight:      in.Weight,
		Enabled:     in.Enabled,
		StartAt:     in.StartAt,
		EndAt:       in.EndAt,
	}
}

type createInput struct {
	Body adDraftInput
}

type replaceInput struct {
	ID   int `path:"id" minimum:"1"`
	Body adDraftInput
}

func toSlots(values []string) []ad.Slot {
	slots := make([]ad.Slot, len(values))
	for i, value := range values {
		slots[i] = ad.Slot(value)
	}
	return slots
}
