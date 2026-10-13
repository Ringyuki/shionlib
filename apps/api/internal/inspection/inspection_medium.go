package inspection

import (
	"path"
	"slices"
	"strconv"
	"strings"
)

const recoveryMark = "rr"

var SheetExtensions = []string{"mds", "cue", "ccd", "sub"}

var mediumOrder = []string{"ccd", "iso", "mdf", "mds", "bin", "img", "cue", "sub", "cdi", "nrg", "mdx", "isz"}

func Medium(names []string, archive Archive) string {
	var found []string
	for _, name := range names {
		extension := strings.ToLower(strings.TrimPrefix(path.Ext(name), "."))
		if extension != "" && !slices.Contains(found, extension) {
			found = append(found, extension)
		}
	}
	if len(found) == 0 {
		return ""
	}
	slices.SortStableFunc(found, func(a, b string) int { return mediumRank(a) - mediumRank(b) })
	if archive.Recovery {
		mark := recoveryMark
		if archive.RecoveryPercent > 0 {
			mark += strconv.Itoa(archive.RecoveryPercent)
		}
		found = append(found, mark)
	}
	return strings.Join(found, "+")
}

func mediumRank(extension string) int {
	if at := slices.Index(mediumOrder, extension); at >= 0 {
		return at
	}
	return len(mediumOrder)
}
