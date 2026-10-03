package gamepg

import (
	"cmp"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

func toDetail(row *ent.Game) game.Detail {
	card := toCard(row)
	detail := game.Detail{
		ID:             row.ID,
		VID:            row.VID,
		BID:            row.BID,
		HID:            row.HID,
		TitleJP:        row.TitleJp,
		TitleZH:        row.TitleZh,
		TitleEN:        row.TitleEn,
		Aliases:        nonNil(row.Aliases),
		IntroJP:        row.IntroJp,
		IntroZH:        row.IntroZh,
		IntroEN:        row.IntroEn,
		ReleaseDate:    row.ReleaseDate,
		ReleaseDateTBA: row.ReleaseDateTba,
		NSFW:           row.Nsfw,
		Type:           row.Type,
		Platforms:      nonNil(row.Platform),
		ExtraInfo:      decodeExtraInfo(row.ExtraInfo),
		Staffs:         decodeStaffs(row.Staffs),
		Covers:         card.Covers,
		Images:         make([]game.Image, 0, len(row.Edges.Images)),
		Developers:     card.Developers,
		Characters:     make([]game.CharacterCredit, 0, len(row.Edges.Characters)),
		Tags:           make([]game.TagLink, 0, len(row.Edges.TagRelations)),
		Links:          make([]game.Link, 0, len(row.Edges.Link)),
	}
	for _, image := range row.Edges.Images {
		detail.Images = append(detail.Images, game.Image{URL: image.URL, Dims: nonNilInts(image.Dims), Sexual: image.Sexual, Violence: image.Violence})
	}
	for _, link := range row.Edges.Link {
		detail.Links = append(detail.Links, game.Link{ID: link.ID, Name: link.Name, Label: link.Label, URL: link.URL})
	}
	for _, relation := range row.Edges.Characters {
		if relation.Edges.Character == nil {
			continue
		}
		credit := game.CharacterCredit{Role: game.CharacterRoleSide, Image: relation.Image, Actor: relation.Actor, Character: ToCharacter(relation.Edges.Character)}
		if relation.Role != nil {
			credit.Role = string(*relation.Role)
		}
		if credit.Image == nil {
			credit.Image = credit.Character.Image
		}
		detail.Characters = append(detail.Characters, credit)
	}
	for _, relation := range row.Edges.TagRelations {
		if relation.Edges.Tag == nil {
			continue
		}
		t := relation.Edges.Tag
		detail.Tags = append(detail.Tags, game.TagLink{Alias: relation.TagAlias, Tag: game.Tag{ID: t.ID, Name: t.Name, Aliases: nonNil(t.Aliases), Count: t.Count}})
	}
	slices.SortFunc(detail.Tags, func(a, b game.TagLink) int {
		return cmp.Or(cmp.Compare(b.Tag.Count, a.Tag.Count), cmp.Compare(a.Tag.ID, b.Tag.ID))
	})
	return detail
}

func ToCharacter(row *ent.GameCharacter) character.Character {
	c := character.Character{
		ID:       row.ID,
		BID:      row.BID,
		VID:      row.VID,
		HID:      row.HID,
		Image:    row.Image,
		NameJP:   row.NameJp,
		NameZH:   row.NameZh,
		NameEN:   row.NameEn,
		Aliases:  nonNil(row.Aliases),
		IntroJP:  row.IntroJp,
		IntroZH:  row.IntroZh,
		IntroEN:  row.IntroEn,
		Height:   row.Height,
		Weight:   row.Weight,
		Bust:     row.Bust,
		Waist:    row.Waist,
		Hips:     row.Hips,
		Cup:      row.Cup,
		Age:      row.Age,
		Birthday: nonNilInts(row.Birthday),
		Gender:   nonNil(row.Gender),
		Created:  row.Created,
		Updated:  row.Updated,
	}
	if row.BloodType != nil {
		bloodType := string(*row.BloodType)
		c.BloodType = &bloodType
	}
	return c
}

type looseEntry map[string]any

func decodeEntries(raw []byte) []looseEntry {
	var entries []looseEntry
	if len(raw) == 0 || json.Unmarshal(raw, &entries) != nil {
		return nil
	}
	return entries
}

func text(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	default:
		return fmt.Sprint(typed)
	}
}

func decodeExtraInfo(raw []byte) []game.ExtraInfo {
	entries := decodeEntries(raw)
	out := make([]game.ExtraInfo, 0, len(entries))
	for _, entry := range entries {
		out = append(out, game.ExtraInfo{Key: text(entry["key"]), Value: text(entry["value"])})
	}
	return out
}

func decodeStaffs(raw []byte) []game.Staff {
	entries := decodeEntries(raw)
	out := make([]game.Staff, 0, len(entries))
	for _, entry := range entries {
		out = append(out, game.Staff{Name: text(entry["name"]), Role: text(entry["role"])})
	}
	return out
}
