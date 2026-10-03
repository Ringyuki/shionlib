package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AIProviderOffer struct {
	ent.Schema
}

func (AIProviderOffer) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_provider_offers")}
}

func (AIProviderOffer) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("provider_id").SchemaType(pg("integer")),
		field.String("upstream_id").MaxLen(200).SchemaType(varchar(200)),
		field.String("name").MaxLen(200).SchemaType(varchar(200)).Optional().Nillable(),
		field.Other("protocols", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.String("canonical_id").MaxLen(200).SchemaType(varchar(200)).Optional().Nillable(),
		field.Time("synced_at").SchemaType(timestamp3),
	}
}

func (AIProviderOffer) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("provider", AIProvider.Type).Ref("offers").Field("provider_id").Unique().Required(),
	}
}

func (AIProviderOffer) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("provider_id", "upstream_id").Unique().StorageKey("ai_provider_offers_provider_id_upstream_id_key"),
		index.Fields("canonical_id").StorageKey("ai_provider_offers_canonical_id_idx"),
	}
}
