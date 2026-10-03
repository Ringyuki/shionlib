package searchpg

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

type Documents struct {
	client *ent.Client
}

func NewDocuments(client *ent.Client) *Documents {
	return &Documents{client: client}
}

func (d *Documents) DocumentIDs(ctx context.Context, afterID, limit int) ([]int, error) {
	ids, err := d.client.Game.Query().
		Where(entgame.IDGT(afterID)).
		Order(ent.Asc(entgame.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list game ids for indexing: %w", err)
	}
	return ids, nil
}

func (d *Documents) Documents(ctx context.Context, ids []int) ([]search.Document, error) {
	rows, err := d.client.Game.Query().
		Where(entgame.IDIn(ids...)).
		Order(ent.Asc(entgame.FieldID)).
		WithCovers().
		WithTagRelations(func(q *ent.GameTagRelationQuery) { q.WithTag() }).
		WithDevelopers(func(q *ent.GameDeveloperRelationQuery) { q.WithDeveloper() }).
		WithCharacters(func(q *ent.GameCharacterRelationQuery) { q.WithCharacter() }).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load games for indexing: %w", err)
	}
	docs := make([]search.Document, len(rows))
	for i, row := range rows {
		docs[i] = toDocument(row)
	}
	return docs, nil
}

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
