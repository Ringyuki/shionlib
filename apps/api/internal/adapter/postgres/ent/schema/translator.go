package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Translator struct {
	ent.Schema
}

func (Translator) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("translators")}
}

func (Translator) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("name").MaxRuneLen(64).SchemaType(varchar(64)),
		field.String("name_key").MaxRuneLen(64).SchemaType(varchar(64)),
		field.Other("aliases", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Other("alias_keys", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.String("homepage").MaxRuneLen(512).SchemaType(varchar(512)).Optional().Nillable(),
		field.Int("creator_id").SchemaType(pg("integer")).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (Translator) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("credits", GameDownloadResourceTranslator.Type).StorageKey(edge.Symbol("game_download_resource_translators_translator_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Translator) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("name_key").Unique().StorageKey("translators_name_key_key"),
		index.Fields("alias_keys").Annotations(entsql.IndexType("GIN")).StorageKey("translators_alias_keys_idx"),
	}
}
