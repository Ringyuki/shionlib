package download

import (
	"regexp"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"

	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type LegacyResource struct {
	ID        int
	CreatorID int
	Languages []string
	Note      *string
	FileNames []string
	Discs     bool
	Info      Info
}

type LegacyReading struct {
	Translation *Translation
	Translators []string
	ReleaseURL  *string
	Edition     *Edition
	Form        *Form
	ClearNote   bool
}

type LegacyDescription struct {
	Translation *Translation
	Translators []translator.Ref
	ReleaseURL  *string
	Edition     *Edition
	Form        *Form
	ClearNote   bool
}

type LegacyTally struct {
	Resources    int
	Translations map[Translation]int
	Editions     map[Edition]int
	Translators  map[string]int
	Discs        int
	NotesCleared int
}

const (
	legacyBatch          = 200
	legacyOfficialPhrase = `(?:官方[简繁簡中日英]+文?版?|official\s+en\w+\s+version\.?)`
	legacyGroupSuffix    = `(?:汉化组|漢化組|汉化小组|个人汉化|個人漢化|中文化小组|中文化委员会|中文化委員會|汉化委员会|汉化联合会|汉化工作室|汉化小番队)`
	legacyBreaks         = "，,。；;：:!！?？\n[]【】()（）+"
	legacyNoteLimit      = 60
	legacyRemarkLimit    = 30
	legacyNameLimit      = 40
)

var (
	legacyURL           = regexp.MustCompile(`(?is)\[url(?:=[^\]]*)?\](.*?)\[/url\]`)
	legacyOfficialExact = regexp.MustCompile(`(?i)^` + legacyOfficialPhrase + `(?:\s*/\s*` + legacyOfficialPhrase + `)*$`)
	legacyOfficialMark  = regexp.MustCompile(`(?i)官方[简繁簡中日英汉漢]|官中|official\s+en\w+\s+version`)
	legacyHumanMark     = regexp.MustCompile(`汉化|漢化|中文化|翻译|翻譯`)
	legacyMachineMark   = regexp.MustCompile(`(?i)机翻|機翻|机器翻译|机器润色|ai\s*翻译|ai\s*汉化|gpt`)
	legacyMachineExact  = regexp.MustCompile(`(?i)^(?:机翻|机器翻译|ai\s*翻译)$`)
	legacyMixedMark     = regexp.MustCompile(`个人汉化|汉化组|人工汉化|单线汉化`)
	legacyNotGroup      = regexp.MustCompile(`模拟器|模擬器|特典|版$|版本$|硬盘版|生肉|直装|自行|注意|资源|补丁|破解|解压|运行|文件|游玩|^生$`)
	legacyHelper        = regexp.MustCompile(`(?:移植|润色|适配制作|修正)$`)
	legacyJoined        = regexp.MustCompile(`\s*[×✕]\s*|\s+[xX&＆/]\s+`)
	legacyJoinedGroups  = regexp.MustCompile(`(` + legacyGroupSuffix + `)&`)
	legacyAfterGroup    = regexp.MustCompile(`(` + legacyGroupSuffix + `)\s+`)
	legacyGroupEnd      = regexp.MustCompile(legacyGroupSuffix + `$`)
	legacyLeadingGroup  = regexp.MustCompile(`^([^，,。；;：:!！?？\n\[\]【】()（）+]{1,40}?` + legacyGroupSuffix + `)(?:[\s，,(（\[+×]|$)`)
	legacyBracket       = regexp.MustCompile(`\[([^\[\]]+)\]`)
	legacyFileOfficial  = regexp.MustCompile(`^(?:官方[简繁簡中日英]+文?版?|官中)$`)
	legacyFileGroup     = regexp.MustCompile(`^[^+]{1,40}(?:汉化组|漢化組|个人汉化|汉化小组|中文化小组|汉化)$`)
	legacyFileMachine   = regexp.MustCompile(`(?i)gpt`)
	legacyPackage       = regexp.MustCompile(`(?i)パッケージ版|package版`)
	legacyDownload      = regexp.MustCompile(`(?:^|[^A-Za-z])DL版`)
	legacySteam         = regexp.MustCompile(`(?i)steam\s*(?:版|edition)`)
	legacyMedium        = regexp.MustCompile(`\(([^()]+)\)\s*(?:\.part\d+)?\.[A-Za-z0-9]+$`)
	legacyMediumSplit   = regexp.MustCompile(`[+\s%]+`)
	legacyWebAddress    = regexp.MustCompile(`^https?://\S+$`)
)

var legacyDescriptors = []string{"部分汉化", "测试汉化", "不完全汉化", "完整汉化", "汉化", "个人汉化", "机翻"}

var legacyDiscFormats = []string{"iso", "mds", "mdf", "bin", "cue", "ccd", "cdi", "img", "nrg", "mdx", "isz", "bwt", "b5t", "b6t"}

func (r LegacyReading) Empty() bool {
	return r.Translation == nil && r.Edition == nil && r.Form == nil && !r.ClearNote
}

func (t *LegacyTally) count(reading LegacyReading) {
	t.Resources++
	if reading.Translation != nil {
		t.Translations[*reading.Translation]++
	}
	if reading.Edition != nil {
		t.Editions[*reading.Edition]++
	}
	for _, name := range reading.Translators {
		t.Translators[name]++
	}
	if reading.Form != nil {
		t.Discs++
	}
	if reading.ClearNote {
		t.NotesCleared++
	}
}

func ReadLegacy(resource LegacyResource) LegacyReading {
	var out LegacyReading
	if resource.Info.Translation == nil {
		out = legacyTranslation(resource)
	}
	if resource.Info.Edition == nil {
		out.Edition = legacyEdition(resource.FileNames)
	}
	if resource.Info.Form == nil && (resource.Discs || legacyDiscNamed(resource.FileNames)) {
		disc := FormDisc
		out.Form = &disc
	}
	return out
}

func legacyTranslation(resource LegacyResource) LegacyReading {
	if !Translated(resource.Languages) {
		none := TranslationNone
		return LegacyReading{Translation: &none}
	}
	note := ""
	if resource.Note != nil {
		note = strings.TrimSpace(*resource.Note)
	}
	if reading := legacyNote(note); reading.Translation != nil {
		return reading
	}
	return legacyFileNames(resource.FileNames)
}

func legacyNote(note string) LegacyReading {
	if note == "" {
		return LegacyReading{}
	}
	var addresses []string
	for _, found := range legacyURL.FindAllStringSubmatch(note, -1) {
		if address := strings.TrimSpace(found[1]); legacyWebAddress.MatchString(address) && utf8.RuneCountInString(address) <= MaxReleaseURLLength {
			addresses = append(addresses, address)
		}
	}
	rest := strings.TrimSpace(legacyURL.ReplaceAllString(note, " "))
	if !strings.Contains(rest, "[") {
		rest = strings.TrimSpace(strings.TrimRight(rest, "]"))
	}
	short := utf8.RuneCountInString(rest) <= legacyNoteLimit
	switch {
	case legacyOfficialExact.MatchString(strings.Join(strings.Fields(rest), " ")):
		return LegacyReading{Translation: legacyKind(TranslationOfficial), ClearNote: len(addresses) == 0}
	case legacyOfficialMark.MatchString(rest):
		if !short || legacyHumanMark.MatchString(legacyOfficialMark.ReplaceAllString(rest, "")) {
			return LegacyReading{}
		}
		return LegacyReading{Translation: legacyKind(TranslationOfficial)}
	case legacyMachineMark.MatchString(rest):
		return legacyMachine(rest, len(addresses) == 0)
	}
	return legacyGroups(rest, addresses)
}

func legacyMachine(rest string, bare bool) LegacyReading {
	if legacyMachineExact.MatchString(rest) {
		return LegacyReading{Translation: legacyKind(TranslationMachine), ClearNote: bare}
	}
	if utf8.RuneCountInString(rest) > legacyRemarkLimit || strings.ContainsAny(rest, "[]") || legacyMixedMark.MatchString(rest) {
		return LegacyReading{}
	}
	return LegacyReading{Translation: legacyKind(TranslationMachine)}
}

func legacyGroups(rest string, addresses []string) LegacyReading {
	joined := legacyJoinedGroups.ReplaceAllString(legacyJoinVariants(legacyJoined.ReplaceAllString(rest, "×")), "$1×")
	expression, whole := legacyCredits(joined)
	if expression == "" {
		return LegacyReading{}
	}
	names, credited := legacyNames(expression)
	if len(names) == 0 {
		return LegacyReading{}
	}
	reading := LegacyReading{Translation: legacyKind(TranslationGroup), Translators: names}
	if whole && credited && len(addresses) <= 1 {
		reading.ClearNote = true
		if len(addresses) == 1 {
			reading.ReleaseURL = &addresses[0]
		}
	}
	return reading
}

func legacyCredits(joined string) (string, bool) {
	if joined == "" {
		return "", false
	}
	if utf8.RuneCountInString(joined) > legacyNoteLimit || strings.ContainsAny(joined, legacyBreaks) {
		if lead := legacyLeadingGroup.FindStringSubmatch(joined); lead != nil {
			return lead[1], false
		}
		return "", false
	}
	segments := strings.Split(legacyAfterGroup.ReplaceAllString(joined, "$1\n"), "\n")
	credits := []string{segments[0]}
	for _, segment := range segments[1:] {
		if !legacyGroupEnd.MatchString(strings.TrimSpace(segment)) {
			return strings.Join(credits, "×"), false
		}
		credits = append(credits, segment)
	}
	return strings.Join(credits, "×"), true
}

func legacyNames(expression string) ([]string, bool) {
	var names []string
	credited := true
	for part := range strings.SplitSeq(expression, "×") {
		name := strings.Join(strings.Fields(norm.NFC.String(strings.Trim(part, " ]【】"))), " ")
		switch {
		case name == "":
			continue
		case legacyHelper.MatchString(name):
			credited = false
			continue
		case slices.Contains(legacyDescriptors, name), legacyNotGroup.MatchString(name), utf8.RuneCountInString(name) > legacyNameLimit:
			return nil, false
		}
		if !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	if len(names) > translator.MaxPerResource {
		return nil, false
	}
	return names, credited
}

func legacyJoinVariants(text string) string {
	runes := []rune(text)
	for i := 1; i < len(runes)-1; i++ {
		if (runes[i] == 'x' || runes[i] == 'X') && legacyWide(runes[i-1]) && legacyWide(runes[i+1]) {
			runes[i] = '×'
		}
	}
	return string(runes)
}

func legacyWide(r rune) bool {
	return unicode.In(r, unicode.Han, unicode.Hiragana, unicode.Katakana)
}

func legacyFileNames(names []string) LegacyReading {
	for _, name := range names {
		for _, bracket := range legacyBracket.FindAllStringSubmatch(name, -1) {
			inner := strings.TrimSpace(bracket[1])
			if legacyFileOfficial.MatchString(inner) {
				return LegacyReading{Translation: legacyKind(TranslationOfficial)}
			}
			if !legacyFileGroup.MatchString(inner) {
				continue
			}
			if credits, _ := legacyNames(legacyJoined.ReplaceAllString(inner, "×")); len(credits) > 0 {
				return LegacyReading{Translation: legacyKind(TranslationGroup), Translators: credits}
			}
		}
	}
	if slices.ContainsFunc(names, legacyFileMachine.MatchString) {
		return LegacyReading{Translation: legacyKind(TranslationMachine)}
	}
	return LegacyReading{}
}

func legacyEdition(names []string) *Edition {
	for _, name := range names {
		switch {
		case legacyPackage.MatchString(name):
			return legacyEditionOf(EditionPackage)
		case legacyDownload.MatchString(name):
			return legacyEditionOf(EditionDownload)
		case legacySteam.MatchString(name):
			return legacyEditionOf(EditionSteam)
		}
	}
	return nil
}

func legacyDiscNamed(names []string) bool {
	for _, name := range names {
		medium := legacyMedium.FindStringSubmatch(name)
		if medium == nil {
			continue
		}
		for _, token := range legacyMediumSplit.Split(strings.ToLower(medium[1]), -1) {
			if slices.Contains(legacyDiscFormats, token) {
				return true
			}
		}
	}
	return false
}

func legacyKind(kind Translation) *Translation {
	return &kind
}

func legacyEditionOf(edition Edition) *Edition {
	return &edition
}
