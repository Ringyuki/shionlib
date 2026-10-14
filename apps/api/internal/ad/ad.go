package ad

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

const (
	MaxNameLength     = 100
	MaxLinkLength     = 500
	MaxImageLength    = 500
	MinWeight         = 1
	MaxWeight         = 10
	DefaultWeight     = 5
	MaxViewsPerReport = 50
	SlotCacheTTL      = 5 * time.Minute
	SlotCachePrefix   = "ad:slot:"
	ClickWindow       = 10 * time.Minute
	WeekDays          = 7
	MonthDays         = 30
)

type Slot string

const (
	SlotHome     Slot = "home"
	SlotGame     Slot = "game"
	SlotResource Slot = "resource"
	SlotDownload Slot = "download"
	SlotSidebar  Slot = "sidebar"
)

type Material string

const (
	MaterialBanner Material = "banner"
	MaterialSide   Material = "side"
)

type SlotSpec struct {
	Slot     Slot
	Material Material
	Shown    int
}

var slotSpecs = []SlotSpec{
	{Slot: SlotHome, Material: MaterialBanner, Shown: 2},
	{Slot: SlotGame, Material: MaterialBanner, Shown: 2},
	{Slot: SlotResource, Material: MaterialBanner, Shown: 2},
	{Slot: SlotDownload, Material: MaterialBanner, Shown: 1},
	{Slot: SlotSidebar, Material: MaterialSide, Shown: 3},
}

func Specs() []SlotSpec {
	return slices.Clone(slotSpecs)
}

func (s Slot) Spec() (SlotSpec, bool) {
	for _, spec := range slotSpecs {
		if spec.Slot == s {
			return spec, true
		}
	}
	return SlotSpec{}, false
}

var Languages = []string{"zh", "en", "ja"}

type Status string

const (
	StatusRunning   Status = "running"
	StatusScheduled Status = "scheduled"
	StatusEnded     Status = "ended"
	StatusDisabled  Status = "disabled"
)

type Ad struct {
	ID          int
	Name        string
	Link        string
	Banner      *string
	BannerAdult bool
	SideImage   *string
	SideIcon    *string
	SideAdult   bool
	Slots       []Slot
	Languages   []string
	Weight      int
	Enabled     bool
	StartAt     *time.Time
	EndAt       *time.Time
	Created     time.Time
	Updated     time.Time
}

func (a Ad) Has(material Material) bool {
	if material == MaterialSide {
		return a.SideImage != nil && a.SideIcon != nil
	}
	return a.Banner != nil
}

func (a Ad) Status(now time.Time) Status {
	switch {
	case !a.Enabled:
		return StatusDisabled
	case a.EndAt != nil && !a.EndAt.After(now):
		return StatusEnded
	case a.StartAt != nil && a.StartAt.After(now):
		return StatusScheduled
	}
	return StatusRunning
}

func (a Ad) ShownTo(viewer actor.Actor, locale string, material Material) bool {
	if !a.Has(material) || !slices.Contains(a.Languages, locale) {
		return false
	}
	adult := a.BannerAdult
	if material == MaterialSide {
		adult = a.SideAdult
	}
	return !adult || viewer.ContentLimit == actor.ContentLimitJustShow
}

type Draft struct {
	Name        string
	Link        string
	Banner      *string
	BannerAdult bool
	SideImage   *string
	SideIcon    *string
	SideAdult   bool
	Slots       []Slot
	Languages   []string
	Weight      int
	Enabled     bool
	StartAt     *time.Time
	EndAt       *time.Time
}

func (d Draft) Check() error {
	ad := Ad{Banner: d.Banner, SideImage: d.SideImage, SideIcon: d.SideIcon}
	if (d.SideImage == nil) != (d.SideIcon == nil) {
		return ErrSideIncomplete
	}
	if !ad.Has(MaterialBanner) && !ad.Has(MaterialSide) {
		return ErrNoMaterial
	}
	for _, slot := range d.Slots {
		spec, ok := slot.Spec()
		if !ok {
			return ErrInvalidDraft
		}
		if !ad.Has(spec.Material) {
			return ErrSlotNeedsMaterial
		}
	}
	if len(d.Languages) == 0 || slices.ContainsFunc(d.Languages, func(language string) bool { return !slices.Contains(Languages, language) }) {
		return ErrInvalidDraft
	}
	if d.Weight < MinWeight || d.Weight > MaxWeight {
		return ErrInvalidDraft
	}
	if d.StartAt != nil && d.EndAt != nil && !d.EndAt.After(*d.StartAt) {
		return ErrScheduleReversed
	}
	return nil
}

type Visitor struct {
	IP        string
	UserAgent string
}

type ListFilter struct {
	Status *Status
	Slot   *Slot
}

type Page = paging.Page

type Counts struct {
	Views  int
	Clicks int
}

func (c Counts) Add(other Counts) Counts {
	return Counts{Views: c.Views + other.Views, Clicks: c.Clicks + other.Clicks}
}

type Listed struct {
	Ad   Ad
	Week Counts
}

type DailyCount struct {
	AdID int
	Slot Slot
	Day  time.Time
	Counts
}

type DayCounts struct {
	Day time.Time
	Counts
}

type SlotCounts struct {
	Slot Slot
	Counts
}

type Report struct {
	Total Counts
	Days  []DayCounts
	Slots []SlotCounts
}

type Overview struct {
	Running int
	Week    Counts
	Enabled bool
}

type Named struct {
	ID   int
	Name string
}

type SlotSummary struct {
	Spec    SlotSpec
	Running []Named
	Week    Counts
}

type Shown struct {
	ID    int
	Name  string
	Image string
	Icon  *string
}

type Placed struct {
	Slot Slot
	Ads  []Shown
}

type View struct {
	AdID int
	Slot Slot
}
