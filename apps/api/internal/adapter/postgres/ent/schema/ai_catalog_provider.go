package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type AICatalogProvider struct {
	ent.Schema
}

func (AICatalogProvider) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_catalog_providers")}
}

func (AICatalogProvider) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").MaxLen(100).SchemaType(varchar(100)).Immutable(),
		field.String("name").MaxLen(200).SchemaType(varchar(200)),
		field.String("npm").MaxLen(200).SchemaType(varchar(200)).Optional().Nillable(),
		field.String("api_url").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.String("doc_url").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Time("synced_at").SchemaType(timestamp3),
	}
}

func (AICatalogProvider) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("models", AICatalogModel.Type).StorageKey(edge.Symbol("ai_catalog_models_provider_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("providers", AIProvider.Type).StorageKey(edge.Symbol("ai_providers_catalog_provider_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
	}
}
