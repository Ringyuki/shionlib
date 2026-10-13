package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameLink struct {
	ent.Schema
}

func (GameLink) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_links")}
}

func (GameLink) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("url"),
		field.Text("label"),
		field.Text("name"),
		created(),
		updated(),
		field.Int("game_id").SchemaType(pg("integer")),
	}
}

func (GameLink) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).Ref("link").Field("game_id").Unique().Required(),
	}
}

func (GameLink) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id").StorageKey("game_links_game_id_idx"),
	}
}
