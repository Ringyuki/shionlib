package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AIRouteAdjustment struct {
	ent.Schema
}

func (AIRouteAdjustment) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_route_adjustments")}
}

func (AIRouteAdjustment) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("route_id").SchemaType(pg("integer")),
		field.String("kind").MaxLen(16).SchemaType(varchar(16)),
		field.String("value").MaxLen(200).SchemaType(varchar(200)),
		field.String("previous").MaxLen(200).SchemaType(varchar(200)).Optional().Nillable(),
		field.String("error_kind").MaxLen(16).SchemaType(varchar(16)),
		field.Int64("request_id").Optional().Nillable(),
		created(),
	}
}

func (AIRouteAdjustment) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("route", AIRoute.Type).Ref("adjustments").Field("route_id").Unique().Required(),
		edge.From("request", AIRequest.Type).Ref("adjustments").Field("request_id").Unique(),
	}
}

func (AIRouteAdjustment) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("route_id", "kind", "value").Unique().StorageKey("ai_route_adjustments_route_id_kind_value_key"),
		index.Fields("request_id").StorageKey("ai_route_adjustments_request_id_idx"),
	}
}
