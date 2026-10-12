package main

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

const (
	e2eDefaultPassword       = "ShionlibE2E123!"
	e2eUnreachableAIBaseURL  = "http://127.0.0.1:9/v1"
	e2eUnreachableAIKey      = "e2e-unreachable-ai-key"
	e2ePrimaryFixtureGameID  = 1
	e2eMalwareFixtureGameID  = 3
	e2eSeededTagsPerGame     = 2
	e2eHikarinagiSource      = "hikarinagi"
	e2eCatalogEntityGame     = "game"
	e2eDefaultFavoriteName   = "default"
	e2eFavoriteItemNote      = "Seeded favorite item for E2E tests."
	e2eRootCommentText       = "Seeded root comment for E2E."
	e2eReplyCommentText      = "Seeded reply comment for E2E."
	e2eResourceQuestionText  = "Seeded question about the resource for E2E."
	e2eResourceAnswerText    = "Seeded answer from the publisher for E2E."
	e2eResourceNoticeText    = "Seeded notice from the publisher for E2E."
	e2eMalwareReviewDeadline = 24 * time.Hour
)

type e2eSeedUser struct {
	Name                   string
	Email                  string
	Role                   int
	ContentLimit           int
	OnlyGamesWithResources bool
	Background             *string
}

var e2eProfileBackground = "user/e2e/background/seeded.webp"

var e2eSeedUsers = []e2eSeedUser{
	{Name: "e2e_admin", Email: "e2e_admin@shionlib.local", Role: 3, ContentLimit: 3, OnlyGamesWithResources: true},
	{Name: "e2e_user", Email: "e2e_user@shionlib.local", Role: 1, ContentLimit: 2, OnlyGamesWithResources: true},
	{Name: "e2e_mutable_user", Email: "e2e_mutable_user@shionlib.local", Role: 1, ContentLimit: 2, OnlyGamesWithResources: true, Background: &e2eProfileBackground},
	{Name: "e2e_permission_user", Email: "e2e_permission_user@shionlib.local", Role: 1, ContentLimit: 2, OnlyGamesWithResources: true},
	{Name: "e2e_relation_user", Email: "e2e_relation_user@shionlib.local", Role: 1, ContentLimit: 2, OnlyGamesWithResources: true},
	{Name: "e2e_admin_ops_user", Email: "e2e_admin_ops_user@shionlib.local", Role: 1, ContentLimit: 2, OnlyGamesWithResources: true},
	{Name: "e2e_list_all_user", Email: "e2e_list_all_user@shionlib.local", Role: 1, ContentLimit: 3, OnlyGamesWithResources: false},
	{Name: "e2e_list_safe_user", Email: "e2e_list_safe_user@shionlib.local", Role: 1, ContentLimit: 1, OnlyGamesWithResources: false},
	{Name: "e2e_managed_user", Email: "e2e_managed_user@shionlib.local", Role: 1, ContentLimit: 2, OnlyGamesWithResources: true},
}

const (
	e2eAdminIndex   = 0
	e2eMemberIndex  = 1
	e2eMutableIndex = 2
)

type e2eSeededResource struct {
	Platform []string
	Language []string
	Note     string
}

type e2eSeededFile struct {
	Type            int
	FileName        string
	FilePath        *string
	S3FileKey       *string
	FileSize        int64
	FileContentType string
	FileHash        string
	FileStatus      int
	FileCheckStatus int
}

var e2eReportableResource = e2eSeededResource{
	Platform: []string{"win"},
	Language: []string{"en"},
	Note:     "Seeded reportable resource for E2E report flow.",
}

var e2eReportableFile = e2eSeededFile{
	Type:            1,
	FileName:        "seeded-reportable-sample.zip",
	FilePath:        e2ePtr("/tmp/e2e/seeded-reportable-sample.zip"),
	FileSize:        2048,
	FileContentType: "application/zip",
	FileHash:        "e2e-seeded-reportable-hash",
	FileStatus:      3,
	FileCheckStatus: 1,
}

const (
	e2eReportableSHA256 = "0c1f4a5d9e7b3a62c8d1f0e4b6a79325d4c8e1f7a0b2c3d4e5f60718293a4b5c"
	e2eScanEngine       = "ClamAV 1.4.3"
	e2eScanLimit        = 4000 << 20
	e2eSignatureAge     = 24 * time.Hour
	e2eInspectedAge     = 30 * 24 * time.Hour
	e2eInspectedFiles   = 8
	e2eInspectedFolders = 2
	e2eInspectedSize    = 4_008_153_084
	e2eInspectedDiscs   = 2
	e2eDiscFiles        = 2
)

type e2eInspectedEntry struct {
	Parent     int
	Position   int
	Name       string
	Kind       inspection.Kind
	Size       int64
	Items      int
	Children   int
	Preview    inspection.Preview
	Encrypted  bool
	Unreadable bool
	Detail     string
}

var e2eInspectedEntries = []e2eInspectedEntry{
	{Parent: -1, Name: "seeded-sample", Kind: inspection.KindFolder, Size: e2eInspectedSize, Items: 8, Children: 8},
	{Parent: 0, Position: 0, Name: "docs", Kind: inspection.KindFolder, Size: 1024, Items: 1, Children: 1},
	{Parent: 0, Position: 1, Name: "bonus.zip", Kind: inspection.KindArchive, Size: 2048, Encrypted: true, Unreadable: true},
	{Parent: 0, Position: 2, Name: "cover.png", Kind: inspection.KindFile, Size: 4096, Preview: inspection.PreviewImage},
	{Parent: 0, Position: 3, Name: "DISC2.mdx", Kind: inspection.KindDisc, Size: 3_242_352_640, Unreadable: true},
	{Parent: 0, Position: 4, Name: "GAME.bin", Kind: inspection.KindDisc, Size: 759_983_712, Items: 2, Children: 2, Detail: `{"format":"iso9660+joliet","label":"SEEDED_GAME","files":1,"signals":["audio"]}`},
	{Parent: 0, Position: 5, Name: "GAME.cue", Kind: inspection.KindFile, Size: 412, Preview: inspection.PreviewText},
	{Parent: 0, Position: 6, Name: "readme.txt", Kind: inspection.KindFile, Size: 26, Preview: inspection.PreviewText},
	{Parent: 0, Position: 7, Name: "setup.exe", Kind: inspection.KindFile, Size: 5_809_126},
	{Parent: 1, Position: 0, Name: "manual.txt", Kind: inspection.KindFile, Size: 1024},
	{Parent: 5, Position: 0, Name: "SETUP.EXE", Kind: inspection.KindFile, Size: 274_432},
	{Parent: 5, Position: 1, Name: "Track 02", Kind: inspection.KindTrack, Size: 47_839_680, Detail: `{"track":2,"seconds":271}`},
}

var e2eMalwareResource = e2eSeededResource{
	Platform: []string{"win"},
	Language: []string{"en"},
	Note:     "Seeded malware review resource for E2E tests.",
}

var e2eMalwareFile = e2eSeededFile{
	Type:            1,
	FileName:        "seeded-malware-sample.zip",
	S3FileKey:       e2ePtr("e2e/malware/seeded-malware-sample.zip"),
	FileSize:        1024,
	FileContentType: "application/zip",
	FileHash:        "e2e-seeded-malware-hash",
	FileStatus:      3,
	FileCheckStatus: 6,
}

var e2eStalledResource = e2eSeededResource{
	Platform: []string{"win"},
	Language: []string{"en"},
	Note:     "Seeded resource whose check stalled, for the admin E2E tests.",
}

var e2eStalledFile = e2eSeededFile{
	Type:            1,
	FileName:        "seeded-stalled-sample.7z",
	FilePath:        e2ePtr("/tmp/e2e/seeded-stalled-sample.7z"),
	FileSize:        4096,
	FileContentType: "application/x-7z-compressed",
	FileHash:        "e2e-seeded-stalled-hash",
	FileStatus:      2,
	FileCheckStatus: 8,
}

const (
	e2eStalledFailures  = 6
	e2eStalledReason    = "scan service did not answer"
	e2eStalledFor       = 3 * 24 * time.Hour
	e2eSeededReportText = "Seeded report for the admin review flow."
)

type e2eMalwareCase struct {
	Detector              string
	DetectedViruses       []string
	ScanResult            json.RawMessage
	ScanLogPath           string
	ScanLogExcerpt        string
	NotifyUploaderOnAllow bool
}

var e2eSeededMalwareCase = e2eMalwareCase{
	Detector:              "clamscan",
	DetectedViruses:       []string{"Eicar-Test-Signature"},
	ScanResult:            json.RawMessage(`{"engine":"clamscan","infected":true,"viruses":["Eicar-Test-Signature"]}`),
	ScanLogPath:           "/tmp/e2e/clamav.log",
	ScanLogExcerpt:        "... FOUND: Eicar-Test-Signature ...",
	NotifyUploaderOnAllow: true,
}

func e2eParagraph(text string) (json.RawMessage, error) {
	type node struct {
		Type    string `json:"type"`
		Text    string `json:"text,omitempty"`
		Content []node `json:"content,omitempty"`
	}
	return json.Marshal(node{Type: "doc", Content: []node{{
		Type:    "paragraph",
		Content: []node{{Type: "text", Text: text}},
	}}})
}

func e2ePtr[T any](value T) *T {
	return &value
}
