package adpg

import (
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
)

func toAds(rows []*ent.Ad) []ad.Ad {
	ads := make([]ad.Ad, len(rows))
	for i, row := range rows {
		ads[i] = toAd(row)
	}
	return ads
}

func toAd(row *ent.Ad) ad.Ad {
	slots := make([]ad.Slot, len(row.Placement))
	for i, slot := range row.Placement {
		slots[i] = ad.Slot(slot)
	}
	return ad.Ad{
		ID:          row.ID,
		Name:        row.Name,
		Link:        row.Link,
		Banner:      row.Banner,
		BannerAdult: row.BannerAdult,
		SideImage:   row.SideImage,
		SideIcon:    row.SideIcon,
		SideAdult:   row.SideAdult,
		Slots:       slots,
		Languages:   nonNil(row.Languages),
		Weight:      row.Weight,
		Enabled:     row.Enabled,
		StartAt:     row.StartAt,
		EndAt:       row.EndAt,
		Created:     row.Created,
		Updated:     row.Updated,
	}
}

func slotArray(slots []ad.Slot) pgvalue.Strings {
	values := make(pgvalue.Strings, len(slots))
	for i, slot := range slots {
		values[i] = string(slot)
	}
	return values
}

func textArray(values []string) pgvalue.Strings {
	if values == nil {
		return pgvalue.Strings{}
	}
	return pgvalue.Strings(slices.Clone(values))
}

func nonNil(values pgvalue.Strings) []string {
	if values == nil {
		return []string{}
	}
	return slices.Clone([]string(values))
}
