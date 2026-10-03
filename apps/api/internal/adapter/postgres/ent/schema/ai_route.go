package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AIRoute struct {
	ent.Schema
}

func (AIRoute) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_routes")}
}

func (AIRoute) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("model_id").SchemaType(pg("integer")),
		field.Int("provider_id").SchemaType(pg("integer")),
		field.String("upstream_id").MaxLen(200).SchemaType(varchar(200)),
		field.String("protocol").MaxLen(16).SchemaType(varchar(16)),
		field.Bool("price_manual").Default(false),
		field.Float("input_price").Default(0),
		field.Float("output_price").Default(0),
		field.Float("cache_read_price").Optional().Nillable(),
		field.Float("cache_write_price").Optional().Nillable(),
		field.JSON("price_tiers", rawJSON).SchemaType(jsonbType).Optional(),
		field.Other("dropped_params", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Bool("json_mode").Default(false),
		field.Int("priority").SchemaType(pg("integer")).Default(0),
		field.String("status").MaxLen(16).SchemaType(varchar(16)).Default("active"),
		field.String("status_kind").MaxLen(16).SchemaType(varchar(16)).Optional().Nillable(),
		field.String("status_message").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Time("status_at").SchemaType(timestamp3).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (AIRoute) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("model", AIModel.Type).Ref("routes").Field("model_id").Unique().Required(),
		edge.From("provider", AIProvider.Type).Ref("routes").Field("provider_id").Unique().Required(),
		edge.To("adjustments", AIRouteAdjustment.Type).StorageKey(edge.Symbol("ai_route_adjustments_route_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("requests", AIRequest.Type).StorageKey(edge.Symbol("ai_requests_route_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
	}
}

func (AIRoute) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("model_id", "provider_id").Unique().StorageKey("ai_routes_model_id_provider_id_key"),
		index.Fields("provider_id").StorageKey("ai_routes_provider_id_idx"),
		index.Fields("status").StorageKey("ai_routes_status_idx"),
	}
}
