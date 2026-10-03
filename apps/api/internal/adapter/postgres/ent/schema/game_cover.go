package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameCover struct {
	ent.Schema
}

func (GameCover) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_covers")}
}

func (GameCover) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("language"),
		field.Text("url"),
		field.Text("type"),
		field.Other("dims", intsType).SchemaType(intArray).Optional(),
		field.Int("sexual").SchemaType(pg("integer")),
		field.Int("violence").SchemaType(pg("integer")),
		field.Text("source").Optional().Nillable(),
		field.Text("source_key").Optional().Nillable(),
		field.Text("source_url").Optional().Nillable(),
		created(),
		updated(),
		field.Int("game_id").SchemaType(pg("integer")),
	}
}

func (GameCover) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).Ref("covers").Field("game_id").Unique().Required(),
	}
}

func (GameCover) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("source", "source_key").StorageKey("game_covers_source_source_key_idx"),
	}
}
