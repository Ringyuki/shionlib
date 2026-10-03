package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AIRequest struct {
	ent.Schema
}

func (AIRequest) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_requests")}
}

func (AIRequest) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(pg("bigserial")).Immutable(),
		field.String("call_id").SchemaType(pg("uuid")),
		field.String("source").MaxLen(16).SchemaType(varchar(16)),
		field.String("scene").MaxLen(64).SchemaType(varchar(64)).Optional().Nillable(),
		field.Int("model_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("route_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("provider_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.String("upstream_id").MaxLen(200).SchemaType(varchar(200)),
		field.String("protocol").MaxLen(16).SchemaType(varchar(16)),
		field.Bool("ok"),
		field.String("error_kind").MaxLen(16).SchemaType(varchar(16)).Optional().Nillable(),
		field.String("error_message").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.Text("error_detail").Optional().Nillable(),
		field.String("adaptation").MaxLen(100).SchemaType(varchar(100)).Optional().Nillable(),
		field.String("finish_reason").MaxLen(32).SchemaType(varchar(32)).Optional().Nillable(),
		field.Int("first_token_ms").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("duration_ms").SchemaType(pg("integer")),
		field.Int("input_tokens").SchemaType(pg("integer")).Default(0),
		field.Int("output_tokens").SchemaType(pg("integer")).Default(0),
		field.Int("cache_read_tokens").SchemaType(pg("integer")).Default(0),
		field.Int("cache_write_tokens").SchemaType(pg("integer")).Default(0),
		field.Int("reasoning_tokens").SchemaType(pg("integer")).Default(0),
		field.Float("cost_usd").Default(0),
		created(),
	}
}

func (AIRequest) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("model", AIModel.Type).Ref("requests").Field("model_id").Unique(),
		edge.From("route", AIRoute.Type).Ref("requests").Field("route_id").Unique(),
		edge.From("provider", AIProvider.Type).Ref("requests").Field("provider_id").Unique(),
		edge.To("payload", AIRequestPayload.Type).Unique().StorageKey(edge.Symbol("ai_request_payloads_request_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("adjustments", AIRouteAdjustment.Type).StorageKey(edge.Symbol("ai_route_adjustments_request_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
	}
}

func (AIRequest) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("created").StorageKey("ai_requests_created_idx"),
		index.Fields("scene", "created").StorageKey("ai_requests_scene_created_idx"),
		index.Fields("model_id", "created").StorageKey("ai_requests_model_id_created_idx"),
		index.Fields("route_id", "created").StorageKey("ai_requests_route_id_created_idx"),
		index.Fields("provider_id", "created").StorageKey("ai_requests_provider_id_created_idx"),
		index.Fields("call_id").StorageKey("ai_requests_call_id_idx"),
	}
}
