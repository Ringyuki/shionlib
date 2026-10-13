package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Tag struct {
	ent.Schema
}

func (Tag) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("tags")}
}

func (Tag) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.Text("name").Unique(),
		field.Other("aliases", stringsType).SchemaType(textArray).Optional().Annotations(emptyArray("text[]")),
		field.Int("count").SchemaType(pg("integer")).Default(0),
		created(),
		updated(),
	}
}

func (Tag) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("games", Game.Type).Ref("tags").Through("game_relations", GameTagRelation.Type),
	}
}

func (Tag) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("count").StorageKey("tags_count_idx"),
		index.Fields("name").Annotations(entsql.IndexType("GIN"), entsql.OpClass("gin_trgm_ops")).StorageKey("tags_name_trgm_idx"),
	}
}
