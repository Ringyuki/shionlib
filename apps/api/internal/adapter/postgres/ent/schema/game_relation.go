package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameRelation struct {
	ent.Schema
}

func (GameRelation) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_relations")}
}

func (GameRelation) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("from_game_id").SchemaType(pg("integer")),
		field.Int("to_game_id").SchemaType(pg("integer")),
		field.Enum("relation").Values("SEQUEL", "PREQUEL", "SIDE_STORY", "MAIN_STORY", "VARIANT", "MAIN_VERSION", "COLLECTION", "COLLECTED_WORK", "SAME_UNIVERSE", "DIFFERENT_ADAPTATION", "EXPANSION").SchemaType(pgEnum("game_relation_type")),
		created(),
		updated(),
	}
}

func (GameRelation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("from_game", Game.Type).Ref("relations_from").Field("from_game_id").Unique().Required(),
		edge.From("to_game", Game.Type).Ref("relations_to").Field("to_game_id").Unique().Required(),
	}
}

func (GameRelation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("from_game_id", "to_game_id").Unique().StorageKey("game_relations_from_game_id_to_game_id_key"),
		index.Fields("from_game_id").StorageKey("game_relations_from_game_id_idx"),
		index.Fields("to_game_id").StorageKey("game_relations_to_game_id_idx"),
	}
}
