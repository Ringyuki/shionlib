package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type FavoriteItem struct {
	ent.Schema
}

func (FavoriteItem) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("favorite_items")}
}

func (FavoriteItem) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("favorite_id").SchemaType(pg("integer")),
		field.Int("game_id").SchemaType(pg("integer")),
		field.String("note").MaxLen(2000).SchemaType(varchar(2000)).Optional().Nillable(),
		created(),
		updated(),
	}
}

func (FavoriteItem) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("favorite", Favorite.Type).Ref("items").Field("favorite_id").Unique().Required(),
		edge.From("game", Game.Type).Ref("favorite_items").Field("game_id").Unique().Required(),
	}
}

func (FavoriteItem) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("favorite_id", "game_id").Unique().StorageKey("favorite_items_favorite_id_game_id_key"),
	}
}
