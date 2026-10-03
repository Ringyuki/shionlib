package searchpg

import (
	"encoding/json"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

func toDocument(row *ent.Game) search.Document {
	doc := search.Document{
		ID:          row.ID,
		TitleJP:     row.TitleJp,
		TitleZH:     row.TitleZh,
		TitleEN:     row.TitleEn,
		IntroJP:     row.IntroJp,
		IntroZH:     row.IntroZh,
		IntroEN:     row.IntroEn,
		Aliases:     row.Aliases,
		Platform:    row.Platform,
		NSFW:        row.Nsfw,
		ReleaseDate: row.ReleaseDate,
	}
	for _, cover := range row.Edges.Covers {
		doc.MaxCoverSexual = max(doc.MaxCoverSexual, cover.Sexual)
	}
	for _, relation := range row.Edges.TagRelations {
		switch {
		case relation.TagAlias != nil && *relation.TagAlias != "":
			doc.Tags = append(doc.Tags, *relation.TagAlias)
		case relation.Edges.Tag != nil:
			doc.Tags = append(doc.Tags, relation.Edges.Tag.Name)
		}
	}
	for _, relation := range row.Edges.Developers {
		if developer := relation.Edges.Developer; developer != nil {
			doc.Developers = append(doc.Developers, search.DocumentDeveloper{ID: developer.ID, Name: developer.Name, Role: relation.Role, Aliases: developer.Aliases})
		}
	}
	for _, relation := range row.Edges.Characters {
		if relation.Actor != nil && *relation.Actor != "" {
			doc.CharacterActors = append(doc.CharacterActors, *relation.Actor)
		}
		character := relation.Edges.Character
		if character == nil {
			continue
		}
		doc.CharacterNamesJP = appendText(doc.CharacterNamesJP, &character.NameJp)
		doc.CharacterNamesZH = appendText(doc.CharacterNamesZH, character.NameZh)
		doc.CharacterNamesEN = appendText(doc.CharacterNamesEN, character.NameEn)
		doc.CharacterAliases = append(doc.CharacterAliases, character.Aliases...)
		doc.CharacterIntrosJP = appendText(doc.CharacterIntrosJP, &character.IntroJp)
		doc.CharacterIntrosZH = appendText(doc.CharacterIntrosZH, &character.IntroZh)
		doc.CharacterIntrosEN = appendText(doc.CharacterIntrosEN, &character.IntroEn)
	}
	var staffs []search.DocumentStaff
	if len(row.Staffs) > 0 && json.Unmarshal(row.Staffs, &staffs) == nil {
		doc.Staffs = staffs
	}
	return doc
}

func appendText(values []string, value *string) []string {
	if value == nil || *value == "" {
		return values
	}
	return append(values, *value)
}
