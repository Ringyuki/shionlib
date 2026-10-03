package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AIProvider struct {
	ent.Schema
}

func (AIProvider) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_providers")}
}

func (AIProvider) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("name").MaxLen(60).SchemaType(varchar(60)),
		field.String("kind").MaxLen(16).SchemaType(varchar(16)),
		field.String("base_url").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Text("api_key").Sensitive(),
		field.String("key_hint").MaxLen(16).SchemaType(varchar(16)),
		field.Float("price_multiplier").Default(1),
		field.String("catalog_provider_id").MaxLen(100).SchemaType(varchar(100)).Optional().Nillable(),
		field.Bool("enabled").Default(true),
		created(),
		updated(),
	}
}

func (AIProvider) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("catalog_provider", AICatalogProvider.Type).Ref("providers").Field("catalog_provider_id").Unique(),
		edge.To("routes", AIRoute.Type).StorageKey(edge.Symbol("ai_routes_provider_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("offers", AIProviderOffer.Type).StorageKey(edge.Symbol("ai_provider_offers_provider_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("requests", AIRequest.Type).StorageKey(edge.Symbol("ai_requests_provider_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
	}
}

func (AIProvider) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("name").Unique().StorageKey("ai_providers_name_key"),
		index.Fields("catalog_provider_id").StorageKey("ai_providers_catalog_provider_id_idx"),
	}
}
