package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type GameCharacterRelation struct {
	ent.Schema
}

func (GameCharacterRelation) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("game_character_relations")}
}

func (GameCharacterRelation) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("image").Optional().Nillable(),
		field.Text("actor").Optional().Nillable(),
		field.Enum("role").Values("main", "primary", "side", "appears").SchemaType(pgEnum("game_character_role")).Optional().Nillable(),
		field.Int("game_id").SchemaType(pg("integer")),
		field.Int("character_id").SchemaType(pg("integer")),
		created(),
		updated(),
	}
}

func (GameCharacterRelation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("character", GameCharacter.Type).Ref("games").Field("character_id").Unique().Required(),
		edge.From("game", Game.Type).Ref("characters").Field("game_id").Unique().Required(),
	}
}

func (GameCharacterRelation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("game_id", "character_id").Unique().StorageKey("game_character_relations_game_id_character_id_key"),
		index.Fields("character_id").StorageKey("game_character_relations_character_id_idx"),
	}
}
