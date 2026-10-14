package ad

import (
	"cmp"
	"slices"
	"time"
)

func Pick(candidates []Ad, spec SlotSpec, random func() float64) []Ad {
	pool := slices.Clone(candidates)
	if spec.Material == MaterialSide {
		slices.SortStableFunc(pool, func(a, b Ad) int {
			return cmp.Or(cmp.Compare(b.Weight, a.Weight), b.Created.Compare(a.Created), cmp.Compare(b.ID, a.ID))
		})
		return pool[:min(spec.Shown, len(pool))]
	}
	picked := make([]Ad, 0, min(spec.Shown, len(pool)))
	for len(picked) < spec.Shown && len(pool) > 0 {
		total := 0
		for _, candidate := range pool {
			total += max(candidate.Weight, 1)
		}
		target := random() * float64(total)
		chosen := len(pool) - 1
		for i, candidate := range pool {
			target -= float64(max(candidate.Weight, 1))
			if target < 0 {
				chosen = i
				break
			}
		}
		picked = append(picked, pool[chosen])
		pool = slices.Delete(pool, chosen, chosen+1)
	}
	return picked
}

func DayOf(at time.Time, offset time.Duration) time.Time {
	local := at.UTC().Add(offset)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

func Summarize(rows []DailyCount, from time.Time, days int) Report {
	report := Report{Days: make([]DayCounts, days), Slots: []SlotCounts{}}
	for i := range days {
		report.Days[i].Day = from.AddDate(0, 0, i)
	}
	bySlot := map[Slot]Counts{}
	for _, row := range rows {
		report.Total = report.Total.Add(row.Counts)
		bySlot[row.Slot] = bySlot[row.Slot].Add(row.Counts)
		if index := int(row.Day.Sub(from).Hours() / 24); index >= 0 && index < days {
			report.Days[index].Counts = report.Days[index].Add(row.Counts)
		}
	}
	for _, spec := range slotSpecs {
		if counts, ok := bySlot[spec.Slot]; ok {
			report.Slots = append(report.Slots, SlotCounts{Slot: spec.Slot, Counts: counts})
		}
	}
	return report
}

func TotalsByAd(rows []DailyCount) map[int]Counts {
	totals := map[int]Counts{}
	for _, row := range rows {
		totals[row.AdID] = totals[row.AdID].Add(row.Counts)
	}
	return totals
}

func TotalsBySlot(rows []DailyCount) map[Slot]Counts {
	totals := map[Slot]Counts{}
	for _, row := range rows {
		totals[row.Slot] = totals[row.Slot].Add(row.Counts)
	}
	return totals
}
