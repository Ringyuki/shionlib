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
	return ad.Ad{
		ID:             row.ID,
		Name:           row.Name,
		Placement:      nonNil(row.Placement),
		ImageZH:        row.ImageZh,
		ImageJA:        row.ImageJa,
		ImageEN:        row.ImageEn,
		Aspect:         row.Aspect,
		Link:           row.Link,
		ExcludeLocales: nonNil(row.ExcludeLocales),
		Enabled:        row.Enabled,
		Sort:           row.Sort,
		StartAt:        row.StartAt,
		EndAt:          row.EndAt,
		Created:        row.Created,
		Updated:        row.Updated,
	}
}

func nonNil(values pgvalue.Strings) []string {
	if values == nil {
		return []string{}
	}
	return slices.Clone([]string(values))
}
