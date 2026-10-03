package main

import (
	"encoding/json"
	"time"
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
	e2eRootCommentHTML       = "<p>Seeded root comment for E2E.</p>"
	e2eReplyCommentText      = "Seeded reply comment for E2E."
	e2eReplyCommentHTML      = "<p>Seeded reply comment for E2E.</p>"
	e2eMalwareReviewDeadline = 24 * time.Hour
)

type e2eSeedUser struct {
	Name                   string
	Email                  string
	Role                   int
	ContentLimit           int
	QuotaSize              int64
	OnlyGamesWithResources bool
}

var e2eSeedUsers = []e2eSeedUser{
	{Name: "e2e_admin", Email: "e2e_admin@shionlib.local", Role: 3, ContentLimit: 3, QuotaSize: 20_000_000_000, OnlyGamesWithResources: true},
	{Name: "e2e_user", Email: "e2e_user@shionlib.local", Role: 1, ContentLimit: 2, QuotaSize: 10_000_000_000, OnlyGamesWithResources: true},
	{Name: "e2e_mutable_user", Email: "e2e_mutable_user@shionlib.local", Role: 1, ContentLimit: 2, QuotaSize: 10_000_000_000, OnlyGamesWithResources: true},
	{Name: "e2e_permission_user", Email: "e2e_permission_user@shionlib.local", Role: 1, ContentLimit: 2, QuotaSize: 10_000_000_000, OnlyGamesWithResources: true},
	{Name: "e2e_relation_user", Email: "e2e_relation_user@shionlib.local", Role: 1, ContentLimit: 2, QuotaSize: 10_000_000_000, OnlyGamesWithResources: true},
	{Name: "e2e_admin_ops_user", Email: "e2e_admin_ops_user@shionlib.local", Role: 1, ContentLimit: 2, QuotaSize: 10_000_000_000, OnlyGamesWithResources: true},
	{Name: "e2e_list_all_user", Email: "e2e_list_all_user@shionlib.local", Role: 1, ContentLimit: 3, QuotaSize: 10_000_000_000, OnlyGamesWithResources: false},
	{Name: "e2e_list_safe_user", Email: "e2e_list_safe_user@shionlib.local", Role: 1, ContentLimit: 1, QuotaSize: 10_000_000_000, OnlyGamesWithResources: false},
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

func e2eLexicalParagraph(text string) (json.RawMessage, error) {
	type textNode struct {
		Type    string `json:"type"`
		Version int    `json:"version"`
		Text    string `json:"text"`
		Mode    string `json:"mode"`
		Style   string `json:"style"`
		Detail  int    `json:"detail"`
		Format  int    `json:"format"`
	}
	type blockNode struct {
		Type      string     `json:"type"`
		Version   int        `json:"version"`
		Format    string     `json:"format"`
		Indent    int        `json:"indent"`
		Direction *string    `json:"direction"`
		Children  []textNode `json:"children"`
	}
	type rootNode struct {
		Type      string      `json:"type"`
		Version   int         `json:"version"`
		Format    string      `json:"format"`
		Indent    int         `json:"indent"`
		Direction *string     `json:"direction"`
		Children  []blockNode `json:"children"`
	}
	document := struct {
		Root rootNode `json:"root"`
	}{
		Root: rootNode{
			Type:    "root",
			Version: 1,
			Children: []blockNode{{
				Type:     "paragraph",
				Version:  1,
				Children: []textNode{{Type: "text", Version: 1, Text: text, Mode: "normal"}},
			}},
		},
	}
	return json.Marshal(document)
}

func e2ePtr[T any](value T) *T {
	return &value
}
