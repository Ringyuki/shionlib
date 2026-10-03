package catalog

import (
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const SourceHikarinagi = "hikarinagi"

const (
	maxTitleLength  = 255
	maxIntroLength  = 20000
	maxNameLength   = 255
	developerRole   = "开发"
	defaultCharRole = "side"
)

type CoverRecord struct {
	Language  string
	Type      string
	URL       string
	Dims      []int
	Sexual    int
	Violence  int
	SourceKey string
}

type ImageRecord struct {
	URL       string
	Dims      []int
	Sexual    int
	Violence  int
	SourceKey string
}

type DeveloperLink struct {
	ExternalID   string
	HikarinagiID *int
	Name         string
	Aliases      []string
	Logo         *string
	Role         string
}

type CharacterLink struct {
	ExternalID   string
	HikarinagiID *int
	NameJP       string
	NameZH       *string
	NameEN       *string
	Image        *string
	Role         string
	Actor        *string
}

type RelationLink struct {
	ExternalID string
	Type       string
}

type GameRecord struct {
	ExternalID     string
	HikarinagiID   *int
	VID            *string
	BID            *string
	TitleJP        string
	TitleZH        string
	TitleEN        string
	IntroJP        string
	IntroZH        string
	IntroEN        string
	Aliases        []string
	ReleaseDate    *time.Time
	ReleaseDateTBA bool
	Type           *string
	Platforms      []string
	NSFW           bool
	Staffs         []Staff
	Covers         []CoverRecord
	Images         []ImageRecord
	Links          []Link
	Tags           []string
	Developers     []DeveloperLink
	Characters     []CharacterLink
	Relations      []RelationLink
	Revision       string
}

type KeyValue struct {
	Key   string
	Value string
}

type DeveloperRecord struct {
	ExternalID   string
	HikarinagiID *int
	VID          *string
	BID          *string
	Name         string
	Aliases      []string
	Logo         *string
	IntroJP      string
	IntroZH      string
	IntroEN      string
	Website      *string
	Extra        []KeyValue
	Revision     string
}

type CharacterRecord struct {
	ExternalID   string
	HikarinagiID *int
	VID          *string
	BID          *string
	NameJP       string
	NameZH       *string
	NameEN       *string
	Aliases      []string
	IntroJP      string
	IntroZH      string
	IntroEN      string
	Image        *string
	BloodType    *string
	Height       *int
	Weight       *int
	Bust         *int
	Waist        *int
	Hips         *int
	Cup          *string
	Age          *int
	Birthday     []int
	Gender       []string
	Revision     string
}

var relationTypes = []string{
	"SEQUEL", "PREQUEL", "SIDE_STORY", "MAIN_STORY", "VARIANT", "MAIN_VERSION",
	"COLLECTION", "COLLECTED_WORK", "SAME_UNIVERSE", "DIFFERENT_ADAPTATION", "EXPANSION",
}

var characterRoles = map[string]string{
	"MAIN":       "main",
	"PRIMARY":    "primary",
	"SUPPORTING": "side",
	"GUEST":      "appears",
}

var producerRoles = map[string]string{
	"DEVELOPER": developerRole,
	"PUBLISHER": "发行",
	"LOCALIZER": "本地化",
}

var genders = map[string]string{
	"男": "m", "♂": "m", "雄": "m", "male": "m", "m": "m",
	"女": "f", "♀": "f", "雌": "f", "female": "f", "f": "f",
	"两性": "a", "both": "a", "a": "a",
	"其他": "o", "不明": "o", "other": "o", "unknown": "o", "o": "o",
}

func ToGameRecord(source string, s GameSnapshot) GameRecord {
	titleJP, titleZH, titleEN := localize(s.Title)
	introJP, introZH, introEN := localize(s.Intro)
	record := GameRecord{
		ExternalID:     s.ExternalID,
		HikarinagiID:   hikarinagiID(source, s.ExternalID),
		VID:            vndbGameID(s.External.VNDB),
		BID:            trimmed(s.External.Bangumi),
		TitleJP:        truncate(titleJP, maxTitleLength),
		TitleZH:        truncate(titleZH, maxTitleLength),
		TitleEN:        truncate(titleEN, maxTitleLength),
		IntroJP:        truncate(introJP, maxIntroLength),
		IntroZH:        truncate(introZH, maxIntroLength),
		IntroEN:        truncate(introEN, maxIntroLength),
		Aliases:        unique(s.Aliases),
		ReleaseDate:    s.ReleaseDate,
		ReleaseDateTBA: s.ReleaseDateTBD,
		Type:           s.Type,
		Platforms:      unique(s.Platforms),
		NSFW:           s.NSFW,
		Staffs:         s.Staff,
		Tags:           unique(s.Tags),
		Links:          s.Links,
		Revision:       s.Revision,
	}
	covers := slices.Clone(s.Covers)
	slices.SortStableFunc(covers, func(a, b Cover) int { return b.Votes - a.Votes })
	for i, cover := range covers {
		record.Covers = append(record.Covers, CoverRecord{
			Language:  CoverLanguage(cover.Language),
			Type:      CoverType(cover.Kind),
			URL:       cover.URL,
			Dims:      dims(cover.Media),
			Sexual:    cover.Sexual,
			Violence:  cover.Violence,
			SourceKey: strconv.Itoa(i),
		})
	}
	for i, image := range s.Images {
		record.Images = append(record.Images, ImageRecord{URL: image.URL, Dims: dims(image), Sexual: image.Sexual, Violence: image.Violence, SourceKey: strconv.Itoa(i)})
	}
	for _, credit := range s.Developers {
		if !IsDeveloperRole(credit.Role) {
			continue
		}
		record.Developers = append(record.Developers, DeveloperLink{
			ExternalID:   credit.ExternalID,
			HikarinagiID: hikarinagiID(source, credit.ExternalID),
			Name:         truncate(credit.Name, maxNameLength),
			Aliases:      unique(credit.Aliases),
			Logo:         mediaURL(credit.Logo),
			Role:         ProducerRole(credit.Role),
		})
	}
	for _, credit := range s.Characters {
		link := CharacterLink{
			ExternalID:   credit.ExternalID,
			HikarinagiID: hikarinagiID(source, credit.ExternalID),
			NameJP:       credit.Name,
			NameZH:       credit.Translated,
			Image:        mediaURL(credit.Image),
			Role:         CharacterRole(credit.Role),
		}
		if len(credit.Actors) > 0 {
			actor := strings.Join(credit.Actors, ", ")
			link.Actor = &actor
		}
		record.Characters = append(record.Characters, link)
	}
	for _, relation := range s.Relations {
		if kind := strings.ToUpper(relation.Type); slices.Contains(relationTypes, kind) {
			record.Relations = append(record.Relations, RelationLink{ExternalID: relation.ExternalID, Type: kind})
		}
	}
	return record
}

func ToDeveloperRecord(source string, s DeveloperSnapshot) DeveloperRecord {
	introJP, introZH, introEN := localize(s.Intro)
	return DeveloperRecord{
		ExternalID:   s.ExternalID,
		HikarinagiID: hikarinagiID(source, s.ExternalID),
		VID:          trimmed(s.External.VNDB),
		BID:          trimmed(s.External.Bangumi),
		Name:         truncate(s.Name, maxNameLength),
		Aliases:      unique(s.Aliases),
		Logo:         mediaURL(s.Logo),
		IntroJP:      truncate(introJP, maxIntroLength),
		IntroZH:      truncate(introZH, maxIntroLength),
		IntroEN:      truncate(introEN, maxIntroLength),
		Website:      trimmed(s.Website),
		Extra:        s.Extra,
		Revision:     s.Revision,
	}
}

func ToCharacterRecord(source string, s CharacterSnapshot) CharacterRecord {
	introJP, introZH, introEN := localizeAsOrigin(s.Intro)
	return CharacterRecord{
		ExternalID:   s.ExternalID,
		HikarinagiID: hikarinagiID(source, s.ExternalID),
		VID:          trimmed(s.External.VNDB),
		BID:          trimmed(s.External.Bangumi),
		NameJP:       s.Name.Origin,
		NameZH:       s.Name.Translated,
		NameEN:       s.Name.English,
		Aliases:      unique(s.Aliases),
		IntroJP:      truncate(introJP, maxIntroLength),
		IntroZH:      truncate(introZH, maxIntroLength),
		IntroEN:      truncate(introEN, maxIntroLength),
		Image:        mediaURL(s.Image),
		BloodType:    BloodType(s.BloodType),
		Height:       s.Height,
		Weight:       s.Weight,
		Bust:         s.Bust,
		Waist:        s.Waist,
		Hips:         s.Hips,
		Cup:          s.Cup,
		Age:          s.Age,
		Birthday:     birthday(s.Birthday),
		Gender:       Genders(s.Gender),
		Revision:     s.Revision,
	}
}

func localize(value Localized) (string, string, string) {
	zhOrigin := value.OriginLang == "zh-Hans" || value.OriginLang == "zh-Hant" || value.OriginLang == "zh"
	enOrigin := value.OriginLang == "en"
	var jp, zh, en string
	if !zhOrigin && !enOrigin {
		jp = value.Origin
	}
	switch {
	case value.Translated != nil:
		zh = *value.Translated
	case zhOrigin:
		zh = value.Origin
	}
	switch {
	case value.English != nil:
		en = *value.English
	case enOrigin:
		en = value.Origin
	}
	return jp, zh, en
}

func localizeAsOrigin(value Localized) (string, string, string) {
	if value.OriginLang == "" {
		value.OriginLang = "ja"
	}
	return localize(value)
}

func CoverLanguage(language string) string {
	switch language {
	case "ja", "jp":
		return "jp"
	case "en":
		return "en"
	case "zh", "zh-Hans", "zh-Hant":
		return "zh"
	default:
		return "unknown"
	}
}

func CoverType(kind string) string {
	if strings.EqualFold(kind, "PKGFRONT") {
		return "pkgfront"
	}
	return "dig"
}

func IsDeveloperRole(role string) bool {
	return role == "" || role == "DEVELOPER"
}

func ProducerRole(role string) string {
	if label, ok := producerRoles[strings.ToUpper(role)]; ok {
		return label
	}
	return developerRole
}

func CharacterRole(role string) string {
	if local, ok := characterRoles[strings.ToUpper(role)]; ok {
		return local
	}
	return defaultCharRole
}

func Genders(values []string) []string {
	var out []string
	for _, value := range values {
		if mapped, ok := genders[strings.ToLower(strings.TrimSpace(value))]; ok && !slices.Contains(out, mapped) {
			out = append(out, mapped)
		}
	}
	return out
}

func BloodType(value *string) *string {
	if value == nil {
		return nil
	}
	normalized := strings.TrimSuffix(strings.TrimSpace(*value), "型")
	normalized = strings.Map(func(r rune) rune {
		if r >= 'Ａ' && r <= 'Ｚ' {
			return r - 'Ａ' + 'A'
		}
		return r
	}, normalized)
	normalized = strings.ToLower(normalized)
	if slices.Contains([]string{"a", "b", "ab", "o"}, normalized) {
		return &normalized
	}
	return nil
}

func hikarinagiID(source, externalID string) *int {
	if source != SourceHikarinagi {
		return nil
	}
	id, err := strconv.Atoi(externalID)
	if err != nil || id <= 0 {
		return nil
	}
	return &id
}

func vndbGameID(raw *string) *string {
	value := trimmed(raw)
	if value == nil {
		return nil
	}
	id := strings.TrimPrefix(strings.ToLower(*value), "v")
	if _, err := strconv.Atoi(id); err != nil {
		return nil
	}
	formatted := "v" + id
	return &formatted
}

func trimmed(raw *string) *string {
	if raw == nil {
		return nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil
	}
	return &value
}

func mediaURL(media *Media) *string {
	if media == nil || media.URL == "" {
		return nil
	}
	url := media.URL
	return &url
}

func dims(media Media) []int {
	if media.Width == nil || media.Height == nil {
		return []int{}
	}
	return []int{*media.Width, *media.Height}
}

func birthday(values []int) []int {
	if len(values) != 2 || values[0] < 1 || values[0] > 12 || values[1] < 1 || values[1] > 31 {
		return []int{}
	}
	return []int{values[0], values[1]}
}

func unique(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !slices.Contains(out, value) {
			out = append(out, value)
		}
	}
	return out
}

func truncate(value string, limit int) string {
	if utf8.RuneCountInString(value) <= limit {
		return value
	}
	runes := []rune(value)
	return string(runes[:limit])
}
