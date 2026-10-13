package nextmoe

import (
	"encoding/json"
	"math"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

const (
	typeSave   = "save"
	typeManual = "manual"
	largest    = float64(1 << 50)
)

var machineTypes = []string{"ai", "machine", "machine_polishing"}

var languages = map[string]string{"zh-Hans": "zh", "zh-Hant": "zh-hant", "ja": "jp", "en": "en"}

var platforms = map[string]string{"windows": "win", "android": "and", "macos": "mac", "ios": "ios", "linux": "lin"}

var sizeUnits = map[string]float64{"k": 1 << 10, "m": 1 << 20, "g": 1 << 30, "t": 1 << 40}

var sizeShape = regexp.MustCompile(`(?i)^(\d+(?:\.\d+)?)\s*(?:([kmgt])i?b?|b)$`)

type patchResource struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Size      string   `json:"size"`
	Hash      string   `json:"hash"`
	Model     string   `json:"model_name"`
	Group     string   `json:"localization_group_name"`
	Type      []string `json:"type"`
	Language  []string `json:"language"`
	Platform  []string `json:"platform"`
	Downloads int      `json:"download_count"`
	WebURL    string   `json:"web_url"`
	UpdatedAt string   `json:"updated_at"`
	Publisher *struct {
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	} `json:"publisher"`
}

func entryOf(raw json.RawMessage) (moyu.Entry, bool) {
	var resource patchResource
	if err := json.Unmarshal(raw, &resource); err != nil {
		return moyu.Entry{}, false
	}
	page := linkOf(resource.WebURL, "https", "http")
	updated, err := time.Parse(time.RFC3339, resource.UpdatedAt)
	if resource.ID == "" || page == "" || err != nil {
		return moyu.Entry{}, false
	}
	entry := moyu.Entry{
		ID:        resource.ID,
		Kind:      moyu.KindPatch,
		Name:      trimmed(resource.Name),
		Size:      sizeOf(resource.Size),
		Hash:      strings.ToLower(trimmed(resource.Hash)),
		Languages: named(resource.Language, languages),
		Platforms: named(resource.Platform, platforms),
		Downloads: max(resource.Downloads, 0),
		URL:       page,
		Updated:   updated.UTC(),
	}
	switch {
	case slices.Contains(resource.Type, typeSave):
		entry.Kind = moyu.KindSave
	case slices.Contains(resource.Type, typeManual):
		group := moyu.TranslationGroup
		entry.Translation, entry.Translator = &group, trimmed(resource.Group)
	case slices.ContainsFunc(resource.Type, func(name string) bool { return slices.Contains(machineTypes, name) }):
		machine := moyu.TranslationMachine
		entry.Translation, entry.Model = &machine, trimmed(resource.Model)
	}
	if resource.Publisher != nil && trimmed(resource.Publisher.Name) != "" {
		entry.Publisher = &moyu.Publisher{Name: trimmed(resource.Publisher.Name), Avatar: linkOf(resource.Publisher.AvatarURL, "https")}
	}
	return entry, true
}

func trimmed(text string) string {
	return strings.TrimFunc(text, func(r rune) bool { return unicode.IsSpace(r) || unicode.Is(unicode.Cf, r) })
}

func named(values []string, names map[string]string) []string {
	out := []string{}
	for _, value := range values {
		if name, ok := names[value]; ok && !slices.Contains(out, name) {
			out = append(out, name)
		}
	}
	return out
}

func linkOf(raw string, schemes ...string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" || !slices.Contains(schemes, parsed.Scheme) {
		return ""
	}
	return parsed.String()
}

func sizeOf(text string) *int64 {
	found := sizeShape.FindStringSubmatch(strings.TrimSpace(text))
	if found == nil {
		return nil
	}
	number, err := strconv.ParseFloat(found[1], 64)
	if err != nil {
		return nil
	}
	if unit := strings.ToLower(found[2]); unit != "" {
		number *= sizeUnits[unit]
	}
	if number < 1 || number > largest {
		return nil
	}
	size := int64(math.Round(number))
	return &size
}
