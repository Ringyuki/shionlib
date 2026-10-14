package adhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
)

type adShownDTO struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Image string  `json:"image" doc:"Key of the banner, or of the sidebar image in the sidebar slot"`
	Icon  *string `json:"icon" doc:"Key of the square icon; only in the sidebar slot"`
}

type adPlacedDTO struct {
	Slot string       `json:"slot" enum:"home,game,resource,download,sidebar"`
	Ads  []adShownDTO `json:"ads"`
}

type adClickDTO struct {
	Link string `json:"link"`
}

type adCountsDTO struct {
	Views  int `json:"views"`
	Clicks int `json:"clicks"`
}

type adminAdDTO struct {
	ID          int         `json:"id"`
	Name        string      `json:"name"`
	Link        string      `json:"link"`
	Banner      *string     `json:"banner"`
	BannerAdult bool        `json:"banner_adult"`
	SideImage   *string     `json:"side_image"`
	SideIcon    *string     `json:"side_icon"`
	SideAdult   bool        `json:"side_adult"`
	Slots       []string    `json:"slots" enum:"home,game,resource,download,sidebar"`
	Languages   []string    `json:"languages" enum:"zh,en,ja"`
	Weight      int         `json:"weight"`
	Enabled     bool        `json:"enabled"`
	Status      string      `json:"status" enum:"running,scheduled,ended,disabled"`
	StartAt     *time.Time  `json:"start_at"`
	EndAt       *time.Time  `json:"end_at"`
	Week        adCountsDTO `json:"week" doc:"Counts of the last seven days; zero outside the list"`
	Created     time.Time   `json:"created"`
	Updated     time.Time   `json:"updated"`
}

type adOverviewDTO struct {
	Running int         `json:"running"`
	Week    adCountsDTO `json:"week"`
	Enabled bool        `json:"enabled" doc:"Whether the ad.enabled setting is on"`
}

type adNamedDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type adSlotSummaryDTO struct {
	Slot     string       `json:"slot" enum:"home,game,resource,download,sidebar"`
	Material string       `json:"material" enum:"banner,side"`
	Shown    int          `json:"shown" doc:"At most this many ads at once"`
	Running  []adNamedDTO `json:"running"`
	Week     adCountsDTO  `json:"week"`
}

type adDayDTO struct {
	Day    string `json:"day" format:"date"`
	Views  int    `json:"views"`
	Clicks int    `json:"clicks"`
}

type adSlotCountsDTO struct {
	Slot   string `json:"slot" enum:"home,game,resource,download,sidebar"`
	Views  int    `json:"views"`
	Clicks int    `json:"clicks"`
}

type adReportDTO struct {
	Total adCountsDTO       `json:"total"`
	Days  []adDayDTO        `json:"days"`
	Slots []adSlotCountsDTO `json:"slots"`
}

func toPlacedDTOs(placed []ad.Placed) []adPlacedDTO {
	out := make([]adPlacedDTO, len(placed))
	for i, slot := range placed {
		ads := make([]adShownDTO, len(slot.Ads))
		for j, item := range slot.Ads {
			ads[j] = adShownDTO{ID: item.ID, Name: item.Name, Image: item.Image, Icon: item.Icon}
		}
		out[i] = adPlacedDTO{Slot: string(slot.Slot), Ads: ads}
	}
	return out
}

func toCountsDTO(counts ad.Counts) adCountsDTO {
	return adCountsDTO{Views: counts.Views, Clicks: counts.Clicks}
}

func toAdminDTO(item ad.Ad, now time.Time) adminAdDTO {
	slots := make([]string, len(item.Slots))
	for i, slot := range item.Slots {
		slots[i] = string(slot)
	}
	languages := item.Languages
	if languages == nil {
		languages = []string{}
	}
	return adminAdDTO{
		ID:          item.ID,
		Name:        item.Name,
		Link:        item.Link,
		Banner:      item.Banner,
		BannerAdult: item.BannerAdult,
		SideImage:   item.SideImage,
		SideIcon:    item.SideIcon,
		SideAdult:   item.SideAdult,
		Slots:       slots,
		Languages:   languages,
		Weight:      item.Weight,
		Enabled:     item.Enabled,
		Status:      string(item.Status(now)),
		StartAt:     item.StartAt,
		EndAt:       item.EndAt,
		Created:     item.Created,
		Updated:     item.Updated,
	}
}

func toSlotSummaryDTOs(summaries []ad.SlotSummary) []adSlotSummaryDTO {
	out := make([]adSlotSummaryDTO, len(summaries))
	for i, summary := range summaries {
		running := make([]adNamedDTO, len(summary.Running))
		for j, item := range summary.Running {
			running[j] = adNamedDTO{ID: item.ID, Name: item.Name}
		}
		out[i] = adSlotSummaryDTO{
			Slot:     string(summary.Spec.Slot),
			Material: string(summary.Spec.Material),
			Shown:    summary.Spec.Shown,
			Running:  running,
			Week:     toCountsDTO(summary.Week),
		}
	}
	return out
}

func toReportDTO(report ad.Report) adReportDTO {
	days := make([]adDayDTO, len(report.Days))
	for i, day := range report.Days {
		days[i] = adDayDTO{Day: day.Day.Format(time.DateOnly), Views: day.Views, Clicks: day.Clicks}
	}
	slots := make([]adSlotCountsDTO, len(report.Slots))
	for i, slot := range report.Slots {
		slots[i] = adSlotCountsDTO{Slot: string(slot.Slot), Views: slot.Views, Clicks: slot.Clicks}
	}
	return adReportDTO{Total: toCountsDTO(report.Total), Days: days, Slots: slots}
}
