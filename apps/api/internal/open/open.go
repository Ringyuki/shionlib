package open

import (
	"cmp"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const MaxValues = 50

var (
	digits   = regexp.MustCompile(`^[0-9]{1,18}$`)
	vndbIDs  = regexp.MustCompile(`^[vV]?([0-9]{1,18})$`)
	maxInt32 = 1<<31 - 1
)

type Kind string

const (
	KindID  Kind = "id"
	KindHID Kind = "hid"
	KindBID Kind = "bid"
	KindVID Kind = "vid"
)

type Game struct {
	ID        int
	HID       *int
	BID       *string
	VID       *string
	TitleJP   string
	TitleZH   string
	TitleEN   string
	NSFW      bool
	Resources []download.GameResource
}

type Result struct {
	Games   []Game
	Missing []string
}

type value struct {
	given     string
	canonical string
}

func parse(kind Kind, raw string) ([]value, error) {
	var values []value
	seen := map[string]bool{}
	for part := range strings.SplitSeq(raw, ",") {
		given := strings.TrimSpace(part)
		if given == "" {
			continue
		}
		canonical, ok := canonicalOf(kind, given)
		if !ok {
			return nil, ErrBadValue.WithArgs(map[string]any{"value": given})
		}
		if seen[canonical] {
			continue
		}
		seen[canonical] = true
		values = append(values, value{given: given, canonical: canonical})
	}
	if len(values) == 0 {
		return nil, ErrOneKind
	}
	if len(values) > MaxValues {
		return nil, ErrTooManyValues.WithArgs(map[string]any{"max": MaxValues})
	}
	return values, nil
}

func canonicalOf(kind Kind, given string) (string, bool) {
	switch kind {
	case KindID, KindHID:
		number, err := strconv.Atoi(given)
		if err != nil || !digits.MatchString(given) || number < 1 || number > maxInt32 {
			return "", false
		}
		return strconv.Itoa(number), true
	case KindBID:
		trimmed := strings.TrimLeft(given, "0")
		if !digits.MatchString(given) || trimmed == "" {
			return "", false
		}
		return trimmed, true
	case KindVID:
		match := vndbIDs.FindStringSubmatch(given)
		if match == nil {
			return "", false
		}
		trimmed := strings.TrimLeft(match[1], "0")
		if trimmed == "" {
			return "", false
		}
		return "v" + trimmed, true
	default:
		return "", false
	}
}

func matching(games []Game, kind Kind, canonical string) []Game {
	var out []Game
	for _, game := range games {
		if keyOf(game, kind) == canonical {
			out = append(out, game)
		}
	}
	slices.SortFunc(out, func(a, b Game) int { return cmp.Compare(a.ID, b.ID) })
	return out
}

func keyOf(game Game, kind Kind) string {
	switch kind {
	case KindID:
		return strconv.Itoa(game.ID)
	case KindHID:
		if game.HID == nil {
			return ""
		}
		return strconv.Itoa(*game.HID)
	case KindBID:
		if game.BID == nil {
			return ""
		}
		return *game.BID
	default:
		if game.VID == nil {
			return ""
		}
		return *game.VID
	}
}
