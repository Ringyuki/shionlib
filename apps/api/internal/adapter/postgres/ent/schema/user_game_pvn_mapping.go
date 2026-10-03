package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type UserGamePvnMapping struct {
	ent.Schema
}

func (UserGamePvnMapping) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("user_game_pvn_mappings")}
}

func (UserGamePvnMapping) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.Int("game_id").SchemaType(pg("integer")),
		field.Int("pvn_galgame_id").SchemaType(pg("integer")),
		field.Int("total_play_time").SchemaType(pg("integer")).Default(0),
		field.Time("last_play_date").SchemaType(timestamp3).Optional().Nillable(),
		field.Int("play_type").SchemaType(pg("integer")).Default(0),
		field.Int("my_rate").SchemaType(pg("integer")).Default(0),
		field.Time("synced_at").SchemaType(timestamp3).Default(now).Annotations(entsql.DefaultExpr("CURRENT_TIMESTAMP")),
		created(),
		updated(),
	}
}

func (UserGamePvnMapping) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("game", Game.Type).Ref("pvn_mappings").Field("game_id").Unique().Required(),
		edge.From("user", User.Type).Ref("game_pvn_mappings").Field("user_id").Unique().Required(),
	}
}

func (UserGamePvnMapping) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "game_id").Unique().StorageKey("user_game_pvn_mappings_user_id_game_id_key"),
		index.Fields("user_id", "pvn_galgame_id").Unique().StorageKey("user_game_pvn_mappings_user_id_pvn_galgame_id_key"),
		index.Fields("user_id").StorageKey("user_game_pvn_mappings_user_id_idx"),
	}
}
