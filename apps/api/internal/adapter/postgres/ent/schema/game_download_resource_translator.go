package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameDownloadResourceTranslator struct {
	ent.Schema
}

func (GameDownloadResourceTranslator) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_download_resource_translators")}
}

func (GameDownloadResourceTranslator) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("resource_id").SchemaType(pg("integer")),
		field.Int("translator_id").SchemaType(pg("integer")),
		field.Int("position").SchemaType(pg("integer")).Default(0),
		created(),
	}
}

func (GameDownloadResourceTranslator) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("resource", GameDownloadResource.Type).Ref("translator_credits").Field("resource_id").Unique().Required(),
		edge.From("translator", Translator.Type).Ref("credits").Field("translator_id").Unique().Required(),
	}
}

func (GameDownloadResourceTranslator) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("resource_id", "translator_id").Unique().StorageKey("game_download_resource_translators_pair_key"),
		index.Fields("translator_id").StorageKey("game_download_resource_translators_translator_id_idx"),
	}
}
