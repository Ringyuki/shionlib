package search

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

var referencePattern = regexp.MustCompile(`^(?:(hid|vid|bid)\s*[:：]?\s*)?(v?)([0-9]{1,9})$`)

func ParseReference(raw string) (game.Reference, bool) {
	match := referencePattern.FindStringSubmatch(strings.ToLower(strings.TrimSpace(raw)))
	if match == nil {
		return game.Reference{}, false
	}
	prefix, vndbStyle := match[1], match[2] == "v"
	number, _ := strconv.Atoi(match[3])
	if number == 0 {
		return game.Reference{}, false
	}
	switch {
	case prefix == "vid" || (prefix == "" && vndbStyle):
		return game.Reference{Source: game.ReferenceVNDB, Number: number}, true
	case vndbStyle:
		return game.Reference{}, false
	case prefix == "hid":
		return game.Reference{Source: game.ReferenceHikarinagi, Number: number}, true
	case prefix == "bid":
		return game.Reference{Source: game.ReferenceBangumi, Number: number}, true
	}
	return game.Reference{}, false
}
