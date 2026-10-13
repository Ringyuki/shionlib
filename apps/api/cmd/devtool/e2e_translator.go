package main

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type e2eSeededTranslator struct {
	Name     string
	Aliases  []string
	Homepage *string
}

const e2eCreditedTranslator = "绿茶汉化组"

var e2eTranslators = []e2eSeededTranslator{
	{Name: e2eCreditedTranslator, Aliases: []string{"Green Tea"}, Homepage: e2ePtr("https://example.org/green-tea")},
	{Name: "默示游戏中文化兴趣小组"},
	{Name: "黙示游戏中文化兴趣小组"},
	{Name: "Can/need汉化组"},
	{Name: "Can/need"},
}

func (s *e2eSeeder) seedTranslators(ctx context.Context, tx *ent.Client, creatorID, creditedResourceID int) error {
	for _, seeded := range e2eTranslators {
		keys := make([]string, len(seeded.Aliases))
		for i, alias := range seeded.Aliases {
			keys[i] = translator.Key(alias)
		}
		row, err := tx.Translator.Create().
			SetName(seeded.Name).
			SetNameKey(translator.Key(seeded.Name)).
			SetAliases(pgvalue.Strings(seeded.Aliases)).
			SetAliasKeys(pgvalue.Strings(keys)).
			SetNillableHomepage(seeded.Homepage).
			SetCreatorID(creatorID).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("seed translator %s: %w", seeded.Name, err)
		}
		if seeded.Name != e2eCreditedTranslator {
			continue
		}
		if err := tx.GameDownloadResourceTranslator.Create().SetResourceID(creditedResourceID).SetTranslatorID(row.ID).SetPosition(0).Exec(ctx); err != nil {
			return fmt.Errorf("credit translator %s: %w", seeded.Name, err)
		}
		err = tx.GameDownloadResource.UpdateOneID(creditedResourceID).
			SetTranslation(string(download.TranslationGroup)).
			SetForm(string(download.FormPortable)).
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("describe the credited resource: %w", err)
		}
	}
	return nil
}
