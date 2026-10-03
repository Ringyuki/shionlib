package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AIModel struct {
	ent.Schema
}

func (AIModel) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_models")}
}

func (AIModel) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("key").MaxLen(200).SchemaType(varchar(200)),
		field.String("name").MaxLen(100).SchemaType(varchar(100)),
		field.String("description").MaxLen(500).SchemaType(varchar(500)).Optional().Nillable(),
		field.String("canonical_id").MaxLen(200).SchemaType(varchar(200)).Optional().Nillable(),
		field.Bool("vision").Default(false),
		field.Bool("moderation").Default(false),
		field.Bool("temperature").Default(true),
		field.Bool("tool_call").Default(false),
		field.Bool("reasoning").Default(false),
		field.Int("context_limit").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("output_limit").SchemaType(pg("integer")).Optional().Nillable(),
		field.Bool("is_default").Default(false),
		field.Bool("enabled").Default(true),
		created(),
		updated(),
	}
}

func (AIModel) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("routes", AIRoute.Type).StorageKey(edge.Symbol("ai_routes_model_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("scenes", AIScene.Type).StorageKey(edge.Symbol("ai_scenes_model_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
		edge.To("requests", AIRequest.Type).StorageKey(edge.Symbol("ai_requests_model_id_fkey")).Annotations(entsql.OnDelete(entsql.SetNull)),
	}
}

func (AIModel) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("key").Unique().StorageKey("ai_models_key_key"),
		index.Fields("canonical_id").Unique().StorageKey("ai_models_canonical_id_key"),
	}
}
