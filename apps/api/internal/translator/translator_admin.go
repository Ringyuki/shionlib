package translator

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
)

type SortField string

const (
	SortByWorks     SortField = "works"
	SortByResources SortField = "resources"
	SortByLatest    SortField = "latest"
	SortByName      SortField = "name"
)

type AdminFilter struct {
	Search     string
	SortBy     SortField
	Descending bool
}

type AdminEntry struct {
	ID             int
	Name           string
	Aliases        []string
	Homepage       *string
	WorksCount     int
	ResourcesCount int
	LatestCredit   *time.Time
}

type Changes struct {
	Name     *string
	Aliases  *[]string
	Homepage patch.Clearable[string]
}

type Distinction struct {
	LowID  int
	HighID int
}

func distinctionOf(a, b int) Distinction {
	if a > b {
		a, b = b, a
	}
	return Distinction{LowID: a, HighID: b}
}

func clusters(entries []AdminEntry, distinct []Distinction) [][]AdminEntry {
	apart := make(map[Distinction]bool, len(distinct))
	for _, pair := range distinct {
		apart[pair] = true
	}
	byKey := map[string][]AdminEntry{}
	var order []string
	for _, entry := range entries {
		key := LooseKey(entry.Name)
		if _, seen := byKey[key]; !seen {
			order = append(order, key)
		}
		byKey[key] = append(byKey[key], entry)
	}
	var out [][]AdminEntry
	for _, key := range order {
		group := byKey[key]
		if len(group) < 2 || settled(group, apart) {
			continue
		}
		slices.SortStableFunc(group, func(a, b AdminEntry) int { return b.ResourcesCount - a.ResourcesCount })
		out = append(out, group)
	}
	slices.SortStableFunc(out, func(a, b []AdminEntry) int { return credited(b) - credited(a) })
	return out
}

func settled(group []AdminEntry, apart map[Distinction]bool) bool {
	for i := range group {
		for j := i + 1; j < len(group); j++ {
			if !apart[distinctionOf(group[i].ID, group[j].ID)] {
				return false
			}
		}
	}
	return true
}

func credited(group []AdminEntry) int {
	total := 0
	for _, entry := range group {
		total += entry.ResourcesCount
	}
	return total
}
