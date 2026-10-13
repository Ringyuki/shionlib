package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameImage struct {
	ent.Schema
}

func (GameImage) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_images")}
}

func (GameImage) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("url"),
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

func (GameImage) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).Ref("images").Field("game_id").Unique().Required(),
	}
}

func (GameImage) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("source", "source_key").StorageKey("game_images_source_source_key_idx"),
		index.Fields("game_id").StorageKey("game_images_game_id_idx"),
	}
}
