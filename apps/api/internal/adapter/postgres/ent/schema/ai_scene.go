package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AIScene struct {
	ent.Schema
}

func (AIScene) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("ai_scenes")}
}

func (AIScene) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("key").MaxLen(64).SchemaType(varchar(64)),
		field.Int("model_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Float("temperature").Optional().Nillable(),
		field.Int("max_output_tokens").SchemaType(pg("integer")).Optional().Nillable(),
		field.Int("timeout_ms").SchemaType(pg("integer")).Optional().Nillable(),
		updated(),
	}
}

func (AIScene) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("model", AIModel.Type).Ref("scenes").Field("model_id").Unique(),
	}
}

func (AIScene) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("key").Unique().StorageKey("ai_scenes_key_key"),
		index.Fields("model_id").StorageKey("ai_scenes_model_id_idx"),
	}
}
