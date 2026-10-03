package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Favorite struct {
	ent.Schema
}

func (Favorite) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("favorites")}
}

func (Favorite) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Int("user_id").SchemaType(pg("integer")),
		field.String("name").MaxLen(255).SchemaType(varchar(255)),
		field.String("description").MaxLen(2000).SchemaType(varchar(2000)).Optional().Nillable(),
		field.Bool("is_private").Default(false),
		field.Bool("default").Default(false),
		created(),
		updated(),
	}
}

func (Favorite) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("favorites").Field("user_id").Unique().Required(),
		edge.To("items", FavoriteItem.Type).StorageKey(edge.Symbol("favorite_items_favorite_id_fkey")).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Favorite) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id").StorageKey("favorites_user_id_idx"),
		index.Fields("user_id", "name").Unique().StorageKey("favorites_user_id_name_key"),
	}
}
