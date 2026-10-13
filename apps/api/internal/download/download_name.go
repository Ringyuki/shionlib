package download

import (
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const (
	MaxFileNameLength = 255
	nameDateLayout    = "060102"
	nameJoin          = "×"
	nameLoose         = "files"
)

type NameSource struct {
	Released   *time.Time
	Brand      string
	Title      string
	Translated string
}

type NameInput struct {
	Source    NameSource
	Languages []string
	Info      Info
	Medium    string
	Uploaded  string
}

type FileName struct {
	Before  string
	After   string
	Pending bool
}

type NamePreview struct {
	GameID     int
	ResourceID *int
	Languages  []string
	Info       InfoInput
	Uploaded   string
}

var (
	nameVolumePart   = regexp.MustCompile(`(?i)\.part\d+\.rar$`)
	nameVolumeNumber = regexp.MustCompile(`(?i)(\.[a-z0-9]{1,5})?\.(?:\d{3}|[rz]\d{2,3})$`)
	nameDouble       = regexp.MustCompile(`(?i)\.tar\.[a-z0-9]{1,5}$`)
	nameSingle       = regexp.MustCompile(`\.[A-Za-z0-9]{1,8}$`)
	nameMedium       = regexp.MustCompile(`\(([^()]+)\)\s*(?:\.part\d+)?(?:\.[A-Za-z0-9]{1,8}){1,2}$`)
)

var nameReserved = strings.NewReplacer(`\`, "＼", "/", "／", ":", "：", "*", "＊", "?", "？", `"`, "＂", "<", "＜", ">", "＞", "|", "｜")

var nameEditions = map[Edition]string{EditionDownload: "DL版", EditionPackage: "パッケージ版", EditionSteam: "Steam版"}

func (n FileName) String() string {
	return n.Before + n.After
}

type FileNameReading struct {
	Translation  *Translation
	Translators  []string
	PatchVersion *string
	Edition      *Edition
	EditionName  *string
	Form         *Form
}

var (
	namePatchVersion = regexp.MustCompile(`(?i)^v(?:er)?\.?\s?\d+(?:\.\d+)*[a-z]?$`)
	nameEditionName  = regexp.MustCompile(`^[^\s\[\]()（）]*(?:初回|豪華|豪华|限定|通常|廉価|特別|特装|完全|プレミアム|デラックス)[^\s\[\]()（）]*版$`)
	nameBrackets     = regexp.MustCompile(`\[[^\[\]]*\]|\([^()]*\)`)
)

func ReadFileName(name string) FileNameReading {
	read := legacyFileNames([]string{name})
	out := FileNameReading{Translation: read.Translation, Translators: read.Translators, Edition: legacyEdition([]string{name})}
	if out.Translators == nil {
		out.Translators = []string{}
	}
	for _, bracket := range legacyBracket.FindAllStringSubmatch(name, -1) {
		if version := strings.TrimSpace(bracket[1]); namePatchVersion.MatchString(version) {
			out.PatchVersion = &version
			break
		}
	}
	for _, token := range strings.Fields(nameBrackets.ReplaceAllString(name, " ")) {
		if nameEditionName.MatchString(token) && utf8.RuneCountInString(token) <= MaxEditionNameLength {
			out.EditionName = &token
			break
		}
	}
	if legacyDiscNamed([]string{name}) {
		disc := FormDisc
		out.Form = &disc
	}
	return out
}

func (r GameResource) CanonicalFiles() []int {
	if !r.Canonical {
		return nil
	}
	files := make([]File, len(r.Files))
	for i, file := range r.Files {
		files[i] = file.File
	}
	main := mainFiles(files)
	ids := make([]int, len(main))
	for i, file := range main {
		ids[i] = file.ID
	}
	return ids
}

func (f File) uploadedName() string {
	if f.OriginalName != nil && *f.OriginalName != "" {
		return *f.OriginalName
	}
	return f.Name
}

func mainFiles(files []File) []File {
	if len(files) == 0 {
		return nil
	}
	ordered := slices.Clone(files)
	slices.SortFunc(ordered, func(a, b File) int { return a.ID - b.ID })
	names := make([]string, len(ordered))
	for i, file := range ordered {
		names[i] = file.uploadedName()
	}
	sets := VolumeSets(names)
	if len(sets) == 0 {
		return nil
	}
	main := make([]File, len(sets[0].Members))
	for i, position := range sets[0].Members {
		main[i] = ordered[position]
	}
	return main
}

func SourceOf(card game.Card) NameSource {
	source := NameSource{Released: card.ReleaseDate}
	for _, title := range []string{card.TitleJP, card.TitleEN, card.TitleZH} {
		if strings.TrimSpace(title) != "" {
			source.Title = title
			break
		}
	}
	if strings.TrimSpace(card.TitleZH) != "" && card.TitleZH != source.Title {
		source.Translated = card.TitleZH
	}
	if len(card.Developers) > 0 {
		source.Brand = card.Developers[0].Developer.Name
	}
	return source
}

func NameSuffix(uploaded string) string {
	for _, shape := range []*regexp.Regexp{nameVolumePart, nameVolumeNumber, nameDouble, nameSingle} {
		if suffix := shape.FindString(uploaded); suffix != "" {
			return suffix
		}
	}
	return ""
}

func NamedMedium(name string) string {
	found := nameMedium.FindStringSubmatch(name)
	if found == nil {
		return ""
	}
	tokens := slices.DeleteFunc(legacyMediumSplit.Split(found[1], -1), func(token string) bool { return token == "" })
	named := slices.ContainsFunc(tokens, func(token string) bool {
		return token == nameLoose || slices.Contains(legacyDiscFormats, strings.ToLower(token))
	})
	if !named {
		return ""
	}
	return nameSegment(strings.Join(tokens, "+"))
}

func CanonicalName(in NameInput) FileName {
	title := nameSegment(in.Source.Title)
	translated := ""
	if nameChinese(in.Languages) {
		translated = nameSegment(in.Source.Translated)
	}
	name := nameBuilt(in, title, translated)
	if name.length() > MaxFileNameLength && translated != "" {
		name = nameBuilt(in, title, "")
	}
	if over := name.length() - MaxFileNameLength; over > 0 {
		if runes := []rune(title); len(runes) > over {
			name = nameBuilt(in, strings.TrimSpace(string(runes[:len(runes)-over])), "")
		}
	}
	return name
}

func (n FileName) length() int {
	return utf8.RuneCountInString(n.Before) + utf8.RuneCountInString(n.After)
}

func nameBuilt(in NameInput, title, translated string) FileName {
	suffix := NameSuffix(in.Uploaded)
	parts := slices.DeleteFunc([]string{nameHead(in.Source), title, translated, nameRest(in)}, func(part string) bool { return part == "" })
	before := strings.Join(parts, " ")
	switch {
	case in.Info.Form == nil && in.Medium == "":
		return FileName{Before: before, After: suffix}
	case in.Info.Form == nil:
		return FileName{Before: before + " (" + in.Medium + ")", After: suffix}
	case *in.Info.Form != FormDisc:
		return FileName{Before: before + " (" + nameLoose + ")", After: suffix}
	case !nameDisc(in.Medium):
		return FileName{Before: before + " (", After: ")" + suffix, Pending: true}
	}
	return FileName{Before: before + " (" + in.Medium + ")", After: suffix}
}

func nameDisc(medium string) bool {
	return slices.ContainsFunc(strings.Split(strings.ToLower(medium), "+"), func(token string) bool {
		return slices.Contains(legacyDiscFormats, token)
	})
}

func nameHead(source NameSource) string {
	head := ""
	if source.Released != nil {
		head += "[" + source.Released.UTC().Format(nameDateLayout) + "]"
	}
	if brand := nameSegment(source.Brand); brand != "" {
		head += "[" + brand + "]"
	}
	return head
}

func nameRest(in NameInput) string {
	var rest []string
	if in.Info.Edition != nil {
		rest = append(rest, nameEditions[*in.Info.Edition])
	}
	if in.Info.EditionName != nil {
		rest = append(rest, nameSegment(*in.Info.EditionName))
	}
	rest = append(rest, nameTranslation(in))
	return strings.Join(slices.DeleteFunc(rest, func(part string) bool { return part == "" }), " ")
}

func nameTranslation(in NameInput) string {
	if in.Info.Translation == nil {
		return ""
	}
	label := ""
	switch *in.Info.Translation {
	case TranslationGroup:
		names := make([]string, 0, len(in.Info.Translators))
		for _, credited := range in.Info.Translators {
			if name := nameSegment(credited.Name); name != "" {
				names = append(names, name)
			}
		}
		label = strings.Join(names, nameJoin)
	case TranslationOfficial:
		switch {
		case nameChinese(in.Languages):
			label = "官方中文"
		case slices.Contains(in.Languages, "en"):
			label = "官方英文"
		}
	case TranslationMachine:
		label = "机器翻译"
	}
	if label == "" {
		return ""
	}
	if in.Info.PatchVersion != nil {
		if version := nameSegment(*in.Info.PatchVersion); version != "" {
			return "[" + label + "][" + version + "]"
		}
	}
	return "[" + label + "]"
}

func nameChinese(languages []string) bool {
	return slices.Contains(languages, "zh") || slices.Contains(languages, "zh-hant")
}

func nameSegment(text string) string {
	clean := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, nameReserved.Replace(text))
	return strings.Join(strings.Fields(clean), " ")
}
