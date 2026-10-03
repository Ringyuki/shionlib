package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameDeveloperRelation struct {
	ent.Schema
}

func (GameDeveloperRelation) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_developer_relations")}
}

func (GameDeveloperRelation) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("role").Optional().Nillable(),
		field.Int("game_id").SchemaType(pg("integer")),
		field.Int("developer_id").SchemaType(pg("integer")),
		created(),
		updated(),
	}
}

func (GameDeveloperRelation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("developer", GameDeveloper.Type).Ref("games").Field("developer_id").Unique().Required(),
		edge.From("game", Game.Type).Ref("developers").Field("game_id").Unique().Required(),
	}
}

func (GameDeveloperRelation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id", "developer_id").Unique().StorageKey("game_developer_relations_game_id_developer_id_key"),
		index.Fields("developer_id").StorageKey("game_developer_relations_developer_id_idx"),
	}
}
