package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AIRequestPayload struct {
	ent.Schema
}

func (AIRequestPayload) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_request_payloads")}
}

func (AIRequestPayload) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(pg("bigserial")).Immutable(),
		field.Int64("request_id"),
		field.JSON("input", rawJSON).SchemaType(jsonbType),
		field.Text("output").Optional().Nillable(),
		created(),
	}
}

func (AIRequestPayload) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("request", AIRequest.Type).Ref("payload").Field("request_id").Unique().Required(),
	}
}

func (AIRequestPayload) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("request_id").Unique().StorageKey("ai_request_payloads_request_id_key"),
		index.Fields("created").StorageKey("ai_request_payloads_created_idx"),
	}
}
