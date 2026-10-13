package admin

import (
	"slices"
)

type PermissionEntity string

const (
	PermissionGame      PermissionEntity = "game"
	PermissionCharacter PermissionEntity = "character"
	PermissionDeveloper PermissionEntity = "developer"
)

type PermissionSource string

const (
	SourceRole PermissionSource = "role"
	SourceUser PermissionSource = "user"
	SourceNone PermissionSource = "none"
)

type PermissionMapping struct {
	Field      string
	BitIndex   int
	IsRelation bool
}

type PermissionGroup struct {
	PermissionMapping
	Fields  []string
	Enabled bool
	Source  PermissionSource
	Mutable bool
}

type Permissions struct {
	Entity    PermissionEntity
	RoleMask  int64
	UserMask  int64
	AllowMask int64
	Groups    []PermissionGroup
}

var groupFields = map[PermissionEntity]map[string][]string{
	PermissionGame: {
		"IDS":               {"v_id", "b_id"},
		"TITLES":            {"title_jp", "title_zh", "title_en"},
		"INTROS":            {"intro_jp", "intro_zh", "intro_en"},
		"ALIASES":           {"aliases"},
		"RELEASE":           {"release_date", "release_date_tba"},
		"TYPE":              {"type"},
		"PLATFORMS":         {"platform"},
		"EXTRA":             {"extra_info"},
		"TAGS":              {"tags"},
		"STAFFS":            {"staffs"},
		"MANAGE_LINKS":      {"links"},
		"MANAGE_COVERS":     {"covers"},
		"MANAGE_IMAGES":     {"images"},
		"MANAGE_DEVELOPERS": {"developers"},
		"MANAGE_CHARACTERS": {"characters"},
		"MANAGE_RELATIONS":  {"relations"},
		"STATUS":            {"status"},
		"NSFW":              {"nsfw"},
		"VIEWS":             {"views"},
	},
	PermissionCharacter: {
		"IDS":          {"v_id", "b_id"},
		"NAMES":        {"name_jp", "name_zh", "name_en"},
		"ALIASES":      {"aliases"},
		"INTROS":       {"intro_jp", "intro_zh", "intro_en"},
		"IMAGE":        {"image"},
		"BODY_METRICS": {"blood_type", "height", "weight", "bust", "waist", "hips", "cup", "age", "birthday", "gender"},
		"AGE_BIRTHDAY": {"age", "birthday"},
		"GENDER":       {"gender"},
		"BLOOD_TYPE":   {"blood_type"},
	},
	PermissionDeveloper: {
		"IDS":     {"v_id", "b_id"},
		"NAME":    {"name"},
		"ALIASES": {"aliases"},
		"INTROS":  {"intro_jp", "intro_zh", "intro_en"},
		"EXTRA":   {"extra_info"},
		"LOGO":    {"logo"},
		"WEBSITE": {"website"},
	},
}

func GroupFields(entity PermissionEntity, group string) []string {
	fields, ok := groupFields[entity][group]
	if !ok {
		return []string{}
	}
	return slices.Clone(fields)
}
