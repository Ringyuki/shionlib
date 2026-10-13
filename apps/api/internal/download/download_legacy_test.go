package download_test

import (
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type legacyWant struct {
	translation download.Translation
	translators []string
	release     string
	clear       bool
}

func readNote(note string, files ...string) download.LegacyReading {
	return download.ReadLegacy(download.LegacyResource{Languages: []string{"zh"}, Note: &note, FileNames: files}, download.LegacyEntry{})
}

func TestReadLegacyNotes(t *testing.T) {
	for note, want := range map[string]legacyWant{
		"绿茶汉化组":                                                  {download.TranslationGroup, []string{"绿茶汉化组"}, "", true},
		"破琵琶生产公社":                                                {download.TranslationGroup, []string{"破琵琶生产公社"}, "", true},
		"老菊科技公司 个人汉化":                                            {download.TranslationGroup, []string{"老菊科技公司 个人汉化"}, "", true},
		"绿茶汉化组]":                                                 {download.TranslationGroup, []string{"绿茶汉化组"}, "", true},
		"绿茶汉化组×熊喵守护协会":                                           {download.TranslationGroup, []string{"绿茶汉化组", "熊喵守护协会"}, "", true},
		"Can/Need汉化组 × 破琵琶生产公社汉化组":                               {download.TranslationGroup, []string{"Can/Need汉化组", "破琵琶生产公社汉化组"}, "", true},
		"Eushully图书馆x花咲月明组":                                      {download.TranslationGroup, []string{"Eushully图书馆", "花咲月明组"}, "", true},
		"脸肿汉化组 / AUGUST中文化委员会":                                   {download.TranslationGroup, []string{"脸肿汉化组", "AUGUST中文化委员会"}, "", true},
		"弥生月汉化组&天之圣杯汉化组":                                         {download.TranslationGroup, []string{"弥生月汉化组", "天之圣杯汉化组"}, "", true},
		"他＆她❀心渐近汉化组":                                             {download.TranslationGroup, []string{"他＆她❀心渐近汉化组"}, "", true},
		"X'moe汉化组":                                               {download.TranslationGroup, []string{"X'moe汉化组"}, "", true},
		"樱花飞舞的季节中文化小组 雪雷个人汉化":                                    {download.TranslationGroup, []string{"樱花飞舞的季节中文化小组", "雪雷个人汉化"}, "", true},
		"红茶汉化组 [url]https://tieba.baidu.com/p/10636675263[/url]": {download.TranslationGroup, []string{"红茶汉化组"}, "https://tieba.baidu.com/p/10636675263", true},
		"KDays汉化组 [url][/url]":                                   {download.TranslationGroup, []string{"KDays汉化组"}, "", true},
		"Can/need x 破琵琶生产公社汉化组 [url]https://a.example/[/url] [url]https://b.example/[/url]": {download.TranslationGroup, []string{"Can/need", "破琵琶生产公社汉化组"}, "", false},
		"猫香蕉汉化组 收录了直到最终幕为止的所有游戏":                                                            {download.TranslationGroup, []string{"猫香蕉汉化组"}, "", false},
		"绿茶汉化组 绿茶夏终小队":                                                                      {download.TranslationGroup, []string{"绿茶汉化组"}, "", false},
		"CK-GAL中文化小组 (序章+终章+最终章整合)":                                                         {download.TranslationGroup, []string{"CK-GAL中文化小组"}, "", false},
		"tone MAX汉化联合会 [b]仅共通线汉化[/b]":                                                       {download.TranslationGroup, []string{"tone MAX汉化联合会"}, "", false},
		"famille汉化组，全年龄版":                                                                   {download.TranslationGroup, []string{"famille汉化组"}, "", false},
		"E看不见我个人汉化+天结移植":                                                                    {download.TranslationGroup, []string{"E看不见我个人汉化"}, "", false},
		"心愿屋汉化组×ShiraYukiNoa移植":                                                             {download.TranslationGroup, []string{"心愿屋汉化组"}, "", false},
		"官方中文":                                                                              {download.TranslationOfficial, nil, "", true},
		"官方中文 / Official English Version":                                                   {download.TranslationOfficial, nil, "", true},
		"Official  En" + "lgish  Version":                                                   {download.TranslationOfficial, nil, "", true},
		"官方中日文":                                                                             {download.TranslationOfficial, nil, "", true},
		"官方繁中":                                                                              {download.TranslationOfficial, nil, "", true},
		"未来数位官方中文":                                                                          {download.TranslationOfficial, nil, "", false},
		"北京娱乐通官方汉化":                                                                         {download.TranslationOfficial, nil, "", false},
		"官方中文 此为官方主机逆移植版本":                                                                  {download.TranslationOfficial, nil, "", false},
		"机翻":      {download.TranslationMachine, nil, "", true},
		"机翻仅汉化文本": {download.TranslationMachine, nil, "", false},
		"cx2333&绘未等联合机器润色精修": {download.TranslationMachine, nil, "", false},
	} {
		got := readNote(note)
		release := ""
		if got.ReleaseURL != nil {
			release = *got.ReleaseURL
		}
		if got.Translation == nil || *got.Translation != want.translation || !slices.Equal(got.Translators, want.translators) || release != want.release || got.ClearNote != want.clear {
			t.Errorf("%q read as %+v (release %q), want %+v", note, got, release, want)
		}
	}
}

func TestReadLegacyLeavesWhatItCannotTell(t *testing.T) {
	for _, note := range []string{
		"", "吉里吉里模拟器", "krkr模拟器，依旧data.xp3", "模拟器选择游戏文件 data.xp3 开始游玩", "北美版", "安卓直装", "独立特典", "生", "日文生肉",
		"部分汉化", "白井木学园汉化版本", "uknihs个人适配制作", "注意：可能部分汉化", "请自行下载汉化补丁", "（原版）汉化硬盘版（20230115立绘CG替换重制版）",
		"官方中文 / 末日求生小队汉化组", "心愿屋汉化组 / 官方中文 / Official English Version", "2016+2015+JP 汉化硬盘版 官方中文",
		"香香祭实行委员会 雪那线单线汉化+H部分机翻", "共通线 威廉伯爵个人汉化 + 个人线 AI翻译(sakura-32b)", "【活字同好会】人工汉化，H机翻 已打更新的H机翻补丁，解压文件可直接使用",
		"神月星人&kakehane(星也) 联合汉化", "1. 与原版竖状显示文本不同，此版本采用常规的下方横向显示 2. 不保证文本与原版完整对应，这不是机翻",
	} {
		if got := readNote(note, "[CUBE] your diary 你的日记.7z"); got.Translation != nil || got.ClearNote || len(got.Translators) != 0 {
			t.Errorf("%q read as %+v", note, got)
		}
	}
}

func TestReadLegacyFileNames(t *testing.T) {
	for name, want := range map[string]legacyWant{
		"[BABEL] 秘密基地で秘め事  秘密基地里的羞羞事 汉化硬盘版[最后之作汉化组].zip":  {download.TranslationGroup, []string{"最后之作汉化组"}, "", false},
		"[ルネ] 巨乳エルフ母娘催眠 [csk244 个人汉化].zip":                {download.TranslationGroup, []string{"csk244 个人汉化"}, "", false},
		"[Miel] ようこそ種付け村へ  育种村 汉化硬盘版[官方中文].zip":           {download.TranslationOfficial, nil, "", false},
		"[あざらしそふと] メイドさんのいる暮らし  女仆来我家 [官方简繁中英文].zip":      {download.TranslationOfficial, nil, "", false},
		"[スタジオ奪] UBAI Again 夺AGAIN～再售伴侣～ [v1.01] [官中].7z": {download.TranslationOfficial, nil, "", false},
		"甜蜜女友1Perfect Edition（GPT4.0）-PC.zip":             {download.TranslationMachine, nil, "", false},
	} {
		got := readNote("", name)
		if got.Translation == nil || *got.Translation != want.translation || !slices.Equal(got.Translators, want.translators) || got.ClearNote {
			t.Errorf("%q read as %+v, want %+v", name, got, want)
		}
	}
	for _, name := range []string{
		"[あっぷりけ] Re birth colony -Lost azurite- [部分汉化].7z", "[PULLTOP] 見上げてごらん、夜空の星を 仰望夜空的星辰 [官中+汉化].7z",
		"[FreakilyCharming] 奴隷との生活 与奴隶的生活 [魔改+汉化+原版].rar", "[210730][SukeraSomero] 推しのラブより恋のラブ steam版 (files).7z", "[160609][灰烬天国制作组] 神明的一天世界 [KRKR].7z",
	} {
		if got := readNote("", name); got.Translation != nil {
			t.Errorf("%q read as %+v", name, got)
		}
	}
	if got := readNote("绿茶汉化组", "[BABEL] 妹嫁 [官方中文].zip"); *got.Translation != download.TranslationGroup {
		t.Fatalf("the note is read before the file name: %+v", got)
	}
}

func TestReadLegacyEditionAndForm(t *testing.T) {
	for name, want := range map[string]struct {
		edition download.Edition
		disc    bool
	}{
		"[260424][Key] anemoi -アネモイ- DL版 (files).7z":                       {download.EditionDownload, false},
		"[141219][あざらしそふと] アマカノ パッケージ版 (iso+mds+rr3).7z":                   {download.EditionPackage, true},
		"[G-Collections] Do You Like Horny Bunnies？ Package版 (ccd).rar":    {download.EditionPackage, true},
		"[180810][CUBE] your diary +H steam版 (files).rar":                  {download.EditionSteam, false},
		"[191002][5pb.] この世の果てで恋を唄う少女YU-NO steam edition (iso).rar":        {download.EditionSteam, true},
		"[050527][MOONSTONE] GIFT ～ギフト～ (iso+mds rr3%).rar":                {"", true},
		"[990101][elf] 同級生 (SD bin+cue rr3).rar":                           {"", true},
		"[020101][ALICESOFT] 大悪司 (2枚組 bin+mdf).part1.rar":                  {"", true},
		"[CIRCUS] D.C.5 Plus Happiness ～ダ・カーポ5～プラスハピネス 初回版 (files+rr3).7z": {"", false},
		"[920101][elf] 同級生 (PC98).zip":                                     {"", false},
		"[HDL版] nothing.zip":                                               {"", false},
	} {
		got := download.ReadLegacy(download.LegacyResource{Languages: []string{"jp"}, FileNames: []string{name}}, download.LegacyEntry{})
		edition := download.Edition("")
		if got.Edition != nil {
			edition = *got.Edition
		}
		if edition != want.edition || (got.Form != nil) != want.disc || (got.Form != nil && *got.Form != download.FormDisc) {
			t.Errorf("%q read as edition %q form %v", name, edition, got.Form)
		}
		if got.Translation == nil || *got.Translation != download.TranslationNone {
			t.Errorf("a resource in Japanese only has no translation: %+v", got)
		}
	}
	inspected := download.ReadLegacy(download.LegacyResource{Languages: []string{"jp"}, FileNames: []string{"game.7z"}, Discs: true}, download.LegacyEntry{})
	if inspected.Form == nil || *inspected.Form != download.FormDisc {
		t.Fatalf("a disc image found by the check makes the form a disc: %+v", inspected)
	}
}

func TestReadLegacyKeepsWhatIsAlreadySaid(t *testing.T) {
	machine, steam, portable := download.TranslationMachine, download.EditionSteam, download.FormPortable
	note := "绿茶汉化组"
	described := download.LegacyResource{
		Languages: []string{"zh"}, Note: &note, FileNames: []string{"[BABEL] 妹嫁 DL版 (iso).7z"}, Discs: true,
		Info: download.Info{Translation: &machine, Edition: &steam, Form: &portable},
	}
	if got := download.ReadLegacy(described, download.LegacyEntry{}); !got.Empty() {
		t.Fatalf("nothing is read over what a resource already says: %+v", got)
	}
	half := described
	half.Info = download.Info{Translation: &machine}
	got := download.ReadLegacy(half, download.LegacyEntry{})
	if got.Translation != nil || got.ClearNote || got.Edition == nil || got.Form == nil || got.Empty() {
		t.Fatalf("only what is missing is read: %+v", got)
	}
}

func namedResource(name string, mutate ...func(*download.LegacyResource)) download.LegacyResource {
	resource := download.LegacyResource{Languages: []string{"jp"}, FileNames: []string{name}, Files: []download.LegacyFile{{ID: 7, Name: name}}, Published: true, Info: download.Info{Translation: ptr(download.TranslationNone)}}
	for _, change := range mutate {
		change(&resource)
	}
	return resource
}

func TestReadLegacyTakesTheCanonicalNameWhenEverySegmentIsRead(t *testing.T) {
	released := time.Date(2014, 12, 19, 0, 0, 0, 0, time.UTC)
	titles := download.LegacyEntry{Titles: []string{"アマカノ", "甜蜜女友", "Amakano"}, Released: &released, Brands: []string{"あざらしそふと", "Azarashi Soft"}}
	for name, edition := range map[string]string{
		"[141219][あざらしそふと] アマカノ (iso+mds+rr3).7z":                   "",
		"[あざらしそふと] アマカノ  甜蜜女友.zip":                                  "",
		"[あざらしそふと] アマカノ 甜蜜女友 汉化硬盘版[绿茶汉化组].zip":                      "",
		"[141219][あざらしそふと] アマカノ DL版 (files).rar":                    "",
		"[141219][あざらしそふと] ＡＭＡＫＡＮＯ Steam edition (files).part1.rar": "",
		"[141219][あざらしそふと] アマカノ 初回限定版 (mdf+mds rr3%).rar":           "初回限定版",
		"[141219][あざらしそふと] アマカノ Windows10対応版 [官方中文][v1.02].zip":     "Windows10対応版",
		"[141219] アマカノ パッケージ版 初回版 (bin+cue).rar":                    "初回版",
	} {
		got := download.ReadLegacy(namedResource(name), titles)
		named := ""
		if got.EditionName != nil {
			named = *got.EditionName
		}
		if !slices.Equal(got.Canonical, []int{7}) || named != edition {
			t.Errorf("%q: canonical %v, edition name %q, want %q", name, got.Canonical, named, edition)
		}
	}
}

func TestReadLegacyKeepsANameItCannotReadWhole(t *testing.T) {
	released := time.Date(2014, 12, 19, 0, 0, 0, 0, time.UTC)
	titles := download.LegacyEntry{Titles: []string{"アマカノ", "甜蜜女友", ""}, Released: &released, Brands: []string{"あざらしそふと"}}
	for _, name := range []string{
		"甜蜜女友1Perfect Edition（GPT4.0）-PC.zip",
		"アマカノ.zip",
		"[あざらしそふと] アマカノ 修正パッチ同梱 (iso).rar",
		"[あざらしそふと] アマカノ2 (iso).rar",
		"[あざらしそふと] アマカノ (PlayDRM) (iso+mds+rr3).rar",
		"[あざらしそふと] アマカノ (PC98).zip",
		"[あざらしそふと] アマカノ [部分汉化].7z",
		"[あざらしそふと] アマカノ [AlphaROM Cracker同梱] (mdf+mds).rar",
		"[あざらしそふと] アマカノ 初回版 + OST.7z",
		"[141220][あざらしそふと] アマカノ (iso).rar",
		"[190204][あざらしそふと] アマカノ steam版 (files).rar",
		"[あざらしそふと & Other] アマカノ (iso).rar",
		"[Shiravune] アマカノ steam edition (files).rar",
	} {
		if got := download.ReadLegacy(namedResource(name), titles); len(got.Canonical) != 0 || got.EditionName != nil {
			t.Errorf("%q: %+v", name, got)
		}
	}
	read := "[あざらしそふと] アマカノ (iso).rar"
	for reason, mutate := range map[string]func(*download.LegacyResource){
		"already canonical":       func(r *download.LegacyResource) { r.Canonical = true },
		"not published":           func(r *download.LegacyResource) { r.Published = false },
		"uploaded under its name": func(r *download.LegacyResource) { r.Files[0].OriginalName = ptr("upload.rar") },
		"without files":           func(r *download.LegacyResource) { r.Files = nil },
	} {
		if got := download.ReadLegacy(namedResource(read, mutate), titles); len(got.Canonical) != 0 {
			t.Errorf("%s: %+v", reason, got)
		}
	}
	kept := namedResource("[あざらしそふと] アマカノ 初回版 (iso).rar", func(r *download.LegacyResource) { r.Info.EditionName = ptr("通常版") })
	if got := download.ReadLegacy(kept, titles); got.EditionName != nil || len(got.Canonical) != 1 {
		t.Fatalf("an edition name that is already said is kept: %+v", got)
	}
	set := namedResource("game.part1.rar", func(r *download.LegacyResource) {
		r.Files = []download.LegacyFile{{ID: 1, Name: "[あざらしそふと] アマカノ.part1.rar"}, {ID: 2, Name: "[あざらしそふと] アマカノ.part2.rar"}, {ID: 3, Name: "bonus.zip"}}
	})
	if got := download.ReadLegacy(set, titles); !slices.Equal(got.Canonical, []int{1, 2}) {
		t.Fatalf("every volume of the first set: %+v", got)
	}
}
