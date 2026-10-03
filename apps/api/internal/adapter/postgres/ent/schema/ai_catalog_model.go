package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AICatalogModel struct {
	ent.Schema
}

func (AICatalogModel) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_catalog_models")}
}

func (AICatalogModel) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("provider_id").MaxLen(100).SchemaType(varchar(100)),
		field.String("model_key").MaxLen(200).SchemaType(varchar(200)),
		field.String("canonical_id").MaxLen(200).SchemaType(varchar(200)).Optional().Nillable(),
		field.String("name").MaxLen(200).SchemaType(varchar(200)),
		field.String("type").MaxLen(32).SchemaType(varchar(32)).Optional().Nillable(),
		field.String("family").MaxLen(100).SchemaType(varchar(100)).Optional().Nillable(),
		field.String("npm").MaxLen(200).SchemaType(varchar(200)).Optional().Nillable(),
		field.Other("input_modalities", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Other("output_modalities", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Int("context_limit").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("output_limit").SchemaType(pg("integer")).Optional().Nillable(),
		field.Bool("temperature").Default(true),
		field.Bool("tool_call").Default(false),
		field.Bool("reasoning").Default(false),
		field.Bool("structured_output").Optional().Nillable(),
		field.Float("input_price").Optional().Nillable(),
		field.Float("output_price").Optional().Nillable(),
		field.Float("cache_read_price").Optional().Nillable(),
		field.Float("cache_write_price").Optional().Nillable(),
		field.JSON("price_tiers", rawJSON).SchemaType(jsonbType).Optional(),
		field.String("release_date").MaxLen(32).SchemaType(varchar(32)).Optional().Nillable(),
		field.Time("synced_at").SchemaType(timestamp3),
	}
}

func (AICatalogModel) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("provider", AICatalogProvider.Type).Ref("models").Field("provider_id").Unique().Required(),
	}
}

func (AICatalogModel) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("provider_id", "model_key").Unique().StorageKey("ai_catalog_models_provider_id_model_key_key"),
		index.Fields("canonical_id").StorageKey("ai_catalog_models_canonical_id_idx"),
		index.Fields("model_key").StorageKey("ai_catalog_models_model_key_idx"),
	}
}
