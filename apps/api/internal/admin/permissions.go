package admin

import (
	"context"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
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

func bit(index int) int64 {
	return int64(1) << index
}

func (s *UserService) Permissions(ctx context.Context, who actor.Actor, id int, entity PermissionEntity) (Permissions, error) {
	target, err := s.manageable(ctx, who, id, true)
	if err != nil {
		return Permissions{}, err
	}
	roleMask, err := s.permissions.RoleMask(ctx, target.Role, entity)
	if err != nil {
		return Permissions{}, err
	}
	userMask, err := s.permissions.UserMask(ctx, id, entity)
	if err != nil {
		return Permissions{}, err
	}
	mappings, err := s.permissions.PermissionMappings(ctx, entity)
	if err != nil {
		return Permissions{}, err
	}
	view := Permissions{Entity: entity, RoleMask: roleMask, UserMask: userMask, AllowMask: roleMask | userMask, Groups: make([]PermissionGroup, len(mappings))}
	for i, mapping := range mappings {
		fromRole := roleMask&bit(mapping.BitIndex) != 0
		fromUser := userMask&bit(mapping.BitIndex) != 0
		source := SourceNone
		switch {
		case fromRole:
			source = SourceRole
		case fromUser:
			source = SourceUser
		}
		view.Groups[i] = PermissionGroup{
			PermissionMapping: mapping,
			Fields:            GroupFields(entity, mapping.Field),
			Enabled:           fromRole || fromUser,
			Source:            source,
			Mutable:           !fromRole,
		}
	}
	return view, nil
}

func (s *UserService) SetPermissions(ctx context.Context, who actor.Actor, id int, entity PermissionEntity, bits []int) (int64, error) {
	if _, err := s.manageable(ctx, who, id, true); err != nil {
		return 0, err
	}
	mappings, err := s.permissions.PermissionMappings(ctx, entity)
	if err != nil {
		return 0, err
	}
	valid := make(map[int]bool, len(mappings))
	for _, mapping := range mappings {
		valid[mapping.BitIndex] = true
	}
	invalid := []int{}
	var mask int64
	for _, index := range bits {
		if !valid[index] {
			invalid = append(invalid, index)
			continue
		}
		mask |= bit(index)
	}
	if len(invalid) > 0 {
		return 0, apperror.ErrValidationFailed.WithArgs(map[string]any{"invalidBits": invalid})
	}
	if err := s.permissions.SetUserMask(ctx, id, entity, mask); err != nil {
		return 0, err
	}
	return mask, nil
}
