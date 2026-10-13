package download

import (
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type LegacyFile struct {
	ID           int
	Name         string
	OriginalName *string
}

type LegacyResource struct {
	ID        int
	GameID    int
	CreatorID int
	Languages []string
	Note      *string
	FileNames []string
	Files     []LegacyFile
	Discs     bool
	Published bool
	Canonical bool
	Info      Info
}

type LegacyReading struct {
	Translation *Translation
	Translators []string
	ReleaseURL  *string
	Edition     *Edition
	EditionName *string
	Form        *Form
	ClearNote   bool
	Canonical   []int
}

type LegacyDescription struct {
	Translation *Translation
	Translators []translator.Ref
	ReleaseURL  *string
	Edition     *Edition
	EditionName *string
	Form        *Form
	ClearNote   bool
	Canonical   []int
}

type LegacyEntry struct {
	Titles   []string
	Released *time.Time
	Brands   []string
}

const (
	legacyBatch          = 200
	legacyTranslated     = "汉化硬盘版"
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
	legacyLead          = regexp.MustCompile(`^\s*(?:\[(\d{6})\]\s*)?(?:\[([^\]]*)\]\s*)?`)
	legacyMediumTail    = regexp.MustCompile(`\s*\(([^()]*)\)\s*$`)
	legacyRecovery      = regexp.MustCompile(`^rr\d*$`)
	legacyEditionKind   = regexp.MustCompile(`(?i)パッケージ版|package版|(?:^|[^A-Za-z])DL版|steam\s*(?:版|edition)`)
)

var legacyDescriptors = []string{"部分汉化", "测试汉化", "不完全汉化", "完整汉化", "汉化", "个人汉化", "机翻"}

var legacyDiscFormats = []string{"iso", "mds", "mdf", "bin", "cue", "ccd", "cdi", "img", "nrg", "mdx", "isz", "bwt", "b5t", "b6t"}

func (r LegacyReading) Empty() bool {
	return r.Translation == nil && r.Edition == nil && r.EditionName == nil && r.Form == nil && !r.ClearNote && len(r.Canonical) == 0
}

func LegacyEntryOf(card game.Card) LegacyEntry {
	entry := LegacyEntry{Titles: []string{card.TitleJP, card.TitleZH, card.TitleEN}, Released: card.ReleaseDate}
	if len(card.Developers) > 0 {
		first := card.Developers[0].Developer
		entry.Brands = append([]string{first.Name}, first.Aliases...)
	}
	return entry
}

func ReadLegacy(resource LegacyResource, entry LegacyEntry) LegacyReading {
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
	main := legacyMain(resource)
	if len(main) == 0 || resource.Canonical || !resource.Published {
		return out
	}
	edition, read := legacyNameRead(main[0].Name, entry)
	if !read {
		return out
	}
	if resource.Info.EditionName == nil {
		out.EditionName = edition
	}
	out.Canonical = make([]int, len(main))
	for i, file := range main {
		out.Canonical[i] = file.ID
	}
	return out
}

func legacyMain(resource LegacyResource) []LegacyFile {
	files := make([]File, len(resource.Files))
	for i, file := range resource.Files {
		if file.OriginalName != nil {
			return nil
		}
		files[i] = File{ID: file.ID, Name: file.Name}
	}
	main := mainFiles(files)
	out := make([]LegacyFile, len(main))
	for i, file := range main {
		out[i] = LegacyFile{ID: file.ID, Name: file.Name}
	}
	return out
}

func legacyNameRead(name string, entry LegacyEntry) (*string, bool) {
	stem := strings.TrimSuffix(name, NameSuffix(name))
	lead := legacyLead.FindStringSubmatch(stem)
	if lead == nil || !legacyLeadMatches(lead[1], lead[2], entry) {
		return nil, false
	}
	titles := entry.Titles
	body := stem[len(lead[0]):]
	if medium := legacyMediumTail.FindStringSubmatchIndex(body); medium != nil {
		if !legacyMediumKnown(body[medium[2]:medium[3]]) {
			return nil, false
		}
		body = body[:medium[0]]
	}
	for _, bracket := range legacyBracket.FindAllStringSubmatch(body, -1) {
		inner := strings.TrimSpace(bracket[1])
		if !legacyFileOfficial.MatchString(inner) && !legacyFileGroup.MatchString(inner) && !namePatchVersion.MatchString(inner) {
			return nil, false
		}
		if slices.Contains(legacyDescriptors, inner) {
			return nil, false
		}
	}
	body = strings.ReplaceAll(legacyBracket.ReplaceAllString(body, " "), legacyTranslated, " ")
	wanted := legacyTitleKeys(titles)
	if slices.Contains(wanted, legacyKey(body)) {
		return nil, true
	}
	plain := legacyEditionKind.ReplaceAllString(body, " ")
	if slices.Contains(wanted, legacyKey(plain)) {
		return nil, true
	}
	tokens := strings.Fields(plain)
	for i := len(tokens) - 1; i >= 0; i-- {
		token := tokens[i]
		if !strings.HasSuffix(token, "版") || utf8.RuneCountInString(token) > MaxEditionNameLength {
			continue
		}
		rest := strings.Join(slices.Concat(tokens[:i], tokens[i+1:]), " ")
		if slices.Contains(wanted, legacyKey(rest)) {
			return &token, true
		}
	}
	return nil, false
}

func legacyLeadMatches(date, brand string, entry LegacyEntry) bool {
	if date == "" && brand == "" {
		return false
	}
	if date != "" && (entry.Released == nil || entry.Released.UTC().Format(nameDateLayout) != date) {
		return false
	}
	if brand == "" {
		return true
	}
	wanted := legacyKey(brand)
	return wanted != "" && slices.ContainsFunc(entry.Brands, func(known string) bool { return legacyKey(known) == wanted })
}

func legacyMediumKnown(medium string) bool {
	tokens := slices.DeleteFunc(legacyMediumSplit.Split(strings.ToLower(medium), -1), func(token string) bool { return token == "" })
	if len(tokens) == 0 {
		return false
	}
	for _, token := range tokens {
		if token != nameLoose && !slices.Contains(legacyDiscFormats, token) && !legacyRecovery.MatchString(token) {
			return false
		}
	}
	return true
}

func legacyTitleKeys(titles []string) []string {
	var keys []string
	for _, title := range titles {
		if key := legacyKey(title); key != "" && !slices.Contains(keys, key) {
			keys = append(keys, key)
		}
	}
	single := slices.Clone(keys)
	for _, first := range single {
		for _, second := range single {
			if first != second {
				keys = append(keys, first+second)
			}
		}
	}
	return keys
}

func legacyKey(text string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return unicode.ToLower(r)
		}
		return -1
	}, norm.NFKC.String(text))
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
